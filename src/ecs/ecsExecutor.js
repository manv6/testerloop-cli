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
const { getInputData, line } = require('../utils/helper');
const { getLogger } = require('../logger/logger');
const { setExitCode } = require('../utils/exitCode');

const { sendCommandToEcs } = require('./taskProcessor');
const { getEcsClient } = require('./client');

async function executeEcs(runId, s3RunPath) {
  const {
    specFilesPath,
    tag,
    containerName,
    clusterARN,
    taskDefinition,
    subnets,
    securityGroups,
    uploadToS3RoleArn,
    s3BucketName,
    customCommand,
    ecsPublicIp,
    ecsThreads,
  } = await getInputData();

  const client = await getEcsClient();
  const logger = getLogger();
  const files = getFeatureFiles(specFilesPath);
  const sem = semaphore(ecsThreads > 0 ? ecsThreads : files.length);
  const taskPromises = [];

  if (ecsThreads > 0) {
    logger.info(
      `Throttling executions: only ${ecsThreads} tasks will run concurrently.`,
    );
  } else {
    logger.info(
      `No throttling applied: processing all ${files.length} files concurrently.`,
    );
  }

  for (const file of files) {
    const taskPromise = new Promise((resolve) => {
      sem.take(async () => {
        await processTask(file, {
          client,
          logger,
          tag: tag,
          containerName: containerName,
          clusterARN: clusterARN,
          taskDefinition: taskDefinition,
          subnets: subnets,
          securityGroups: securityGroups,
          uploadToS3RoleArn: uploadToS3RoleArn,
          customCommand: customCommand,
          ecsPublicIp: ecsPublicIp,
          runId,
        });
        resolve();
        sem.leave();
      });
    });
    taskPromises.push(taskPromise);
  }

  await Promise.all(taskPromises);

  logger.info('All tasks have been executed.');
  await handleResult(s3BucketName, s3RunPath, runId);
}

async function processTask(file, config) {
  const {
    client,
    logger,
    tag,
    containerName,
    clusterARN,
    taskDefinition,
    subnets,
    securityGroups,
    uploadToS3RoleArn,
    customCommand,
    ecsPublicIp,
    runId,
  } = config;
  const filename = file.split('/').pop();
  const { unWipedScenarios, fileHasTag, tagsIncludedExcluded } =
    determineFilePropertiesBasedOnTags(file, tag);

  if (!fileHasTag && tag !== undefined) {
    logger.info(
      `* No "${tagsIncludedExcluded.includedTags.join(
        ', ',
      )}" tag in file ${file}`,
    );
  }

  if (!unWipedScenarios) {
    const excludedTagsList = tagsIncludedExcluded.excludedTags.join(', ');
    if (excludedTagsList) {
      logger.info(
        `* All scenarios tagged as "${excludedTagsList}" for ${filename}`,
      );
    }
    return;
  }

  if (fileHasTag && unWipedScenarios) {
    const envVars = await getEcsEnvVariables(runId);
    let finalCommand = customCommand
      ? `timeout 2400 ${customCommand
          .replace(/%TEST_FILE\b/g, file)
          .replace(/%TEST_FILENAME\b/g, filename)}`.split(' ')
      : `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
          ' ',
        );

    try {
      const taskArn = await sendCommandToEcs(
        containerName,
        finalCommand,
        clusterARN,
        taskDefinition,
        subnets,
        securityGroups,
        uploadToS3RoleArn,
        envVars,
        ecsPublicIp,
      );
      logger.info(`+ Executing task: ${taskArn} -> ${filename}`);
      await waitUntilTasksStopped(
        { client, maxWaitTime: 1200, maxDelay: 10, minDelay: 5 },
        { cluster: clusterARN, tasks: [taskArn] },
      );
      logger.info(`Task completed successfully: ${taskArn} -> ${filename}`);
    } catch (error) {
      logger.error(`Error processing file -> ${filename}: ${error}`);
      setExitCode(1);
    }
  }
}

function getFeatureFiles(specFilesPath) {
  let suffix = specFilesPath.includes('.feature') ? '' : '/**/*.feature';
  return glob.sync(`${specFilesPath}${suffix}`);
}

module.exports = { executeEcs };
