const glob = require('glob');
const { waitUntilTasksStopped } = require('@aws-sdk/client-ecs');

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
  let suffix = '/**/*.feature';
  if (specFilesPath.includes('.feature')) suffix = '';
  const files = glob.sync(`${specFilesPath}${suffix}`);

  const concurrencyLimit = ecsThreads > 0 ? ecsThreads : files.length;
  let activeTasks = 0;
  const tasksQueue = [];

  const executeTask = async (file, resolve) => {
    const filename = file.split('/').pop();
    const { unWipedScenarios, fileHasTag, tagsIncludedExcluded } =
      determineFilePropertiesBasedOnTags(file, tag);
    const envVars = await getEcsEnvVariables(runId);
    let finalCommand = customCommand
      ? `timeout 2400 ${customCommand
          .replace(/%TEST_FILE\b/g, file)
          .replace(/%TEST_FILENAME\b/g, filename)}`.split(' ')
      : `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
          ' ',
        );

    if (unWipedScenarios && fileHasTag) {
      sendCommandToEcs(
        containerName,
        finalCommand,
        clusterARN,
        taskDefinition,
        subnets,
        securityGroups,
        uploadToS3RoleArn,
        envVars,
        ecsPublicIp,
      ).then((taskArn) => {
        logger.info(`+ Executing task: ${taskArn} -> ${filename}`);
        waitUntilTasksStopped(
          { client, maxWaitTime: 1200, maxDelay: 10, minDelay: 5 },
          { cluster: clusterARN, tasks: [taskArn] },
        )
          .then(() => {
            logger.info(
              `Task completed successfully: ${taskArn} -> ${filename}`,
            );
            activeTasks--;
            resolve();
            if (tasksQueue.length > 0) {
              const nextTask = tasksQueue.shift();
              nextTask();
            }
          })
          .catch((error) => {
            logger.error(`Error with task ${taskArn} -> ${filename}:`, {
              error,
            });
            setExitCode(1);
            activeTasks--;
            resolve();
          });
      });
    } else {
      if (!fileHasTag && tag !== undefined)
        logger.info(
          `* No "${tagsIncludedExcluded.includedTags}" tag in file ${file}`,
        );

      if (!unWipedScenarios) {
        const excludedTagsList = tagsIncludedExcluded.excludedTags.join(', ');
        if (excludedTagsList) {
          logger.info(
            `* All scenarios tagged as "'${tagsIncludedExcluded.excludedTags}'" for ${filename}`,
          );
        }
      }
      resolve();
    }
  };

  const enqueueTask = (file) => {
    return new Promise((resolve) => {
      if (activeTasks < concurrencyLimit) {
        activeTasks++;
        executeTask(file, resolve);
      } else {
        tasksQueue.push(() => executeTask(file, resolve));
      }
    });
  };

  await Promise.all(files.map((file) => enqueueTask(file)));

  logger.info('All tasks have been executed.');
  await handleResult(s3BucketName, s3RunPath, runId);
}

module.exports = {
  executeEcs,
};
