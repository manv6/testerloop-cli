const glob = require('glob');
const { waitUntilTasksStopped } = require('@aws-sdk/client-ecs');
const semaphore = require('semaphore');

const {
  handleResult,
  determineFilePropertiesBasedOnTags,
} = require('../utils/handlers');
const {
  getEcsEnvVariables,
} = require('../utils/envVariables/envVariablesHandler');
const { getInputData } = require('../utils/helper');
const { getLogger } = require('../logger/logger');
const { setExitCode } = require('../utils/exitCode');

const { sendCommandToEcs } = require('./taskProcessor');
const { getEcsClient } = require('./client');

async function executeEcs(runId, s3RunPath) {
  const inputData = await getInputData();
  const client = await getEcsClient();
  const logger = getLogger();
  const files = getFeatureFiles(inputData.specFilesPath);
  const sem = semaphore(
    inputData.ecsThreads > 0 ? inputData.ecsThreads : files.length,
  );

  logger.info(
    inputData.ecsThreads > 0
      ? `Throttling executions: only ${inputData.ecsThreads} tasks will run concurrently.`
      : `No throttling applied: processing all ${files.length} files concurrently.`,
  );

  const taskPromises = files.map(
    (file) =>
      new Promise((resolve) => {
        sem.take(async () => {
          await processTask(file, inputData, client, logger, runId);
          resolve();
          sem.leave();
        });
      }),
  );

  await Promise.all(taskPromises);
  logger.info('All tasks have been executed.');
  await handleResult(inputData.s3BucketName, s3RunPath, runId);
}

async function processTask(file, inputData, client, logger, runId) {
  const filename = file.split('/').pop();
  const { unWipedScenarios, fileHasTag, tagsIncludedExcluded } =
    determineFilePropertiesBasedOnTags(file, inputData.tag);

  if (!fileHasTag && inputData.tag) {
    logger.info(
      `* No "${tagsIncludedExcluded.includedTags.join(
        ', ',
      )}" tag in file ${file}`,
    );
  }
  if (!unWipedScenarios) {
    const excludedTagsList = tagsIncludedExcluded.excludedTags.join(', ');
    if (excludedTagsList.length > 0) {
      logger.info(
        `* All scenarios tagged as "${excludedTagsList}" for ${filename}`,
      );
    }
    return;
  }

  if (fileHasTag && unWipedScenarios) {
    const envVars = await getEcsEnvVariables(runId);
    const finalCommand = inputData.customCommand
      ? `timeout 2400 ${inputData.customCommand
          .replace(/%TEST_FILE\b/g, file)
          .replace(/%TEST_FILENAME\b/g, filename)}`.split(' ')
      : `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
          ' ',
        );

    try {
      const taskArn = await sendCommandToEcs(
        inputData.containerName,
        finalCommand,
        inputData.clusterARN,
        inputData.taskDefinition,
        inputData.subnets,
        inputData.securityGroups,
        inputData.uploadToS3RoleArn,
        envVars,
        inputData.ecsPublicIp,
        client,
      );
      logger.info(`+ Executing task: ${taskArn} -> ${filename}`);
      await waitUntilTasksStopped(
        { client, maxWaitTime: 1200, maxDelay: 10, minDelay: 5 },
        { cluster: inputData.clusterARN, tasks: [taskArn] },
      );
      logger.info(`Task completed successfully: ${taskArn} -> ${filename}`);
    } catch (error) {
      logger.error(`Error processing file -> ${filename}: ${error}`);
      setExitCode(1);
    }
  }
}

function getFeatureFiles(specFilesPath) {
  return glob.sync(
    `${specFilesPath}${
      specFilesPath.includes('.feature') ? '' : '/**/*.feature'
    }`,
  );
}

module.exports = { executeEcs };
