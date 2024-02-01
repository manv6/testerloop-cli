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
  } = await getInputData();

  const logger = getLogger();

  // Check if we passed one feature file or a whole folder of feature files
  let suffix = '/**/*.feature';
  if (specFilesPath.includes('.feature') === true) suffix = '';
  const files = glob.sync(`${specFilesPath}${suffix}`).map((file) => `${file}`);

  const tasks = [];
  const taskDetails = [];
  const fileNames = [];
  const pendingEcsTasks = [];

  await Promise.all(
    files.map(async (file) => {
      const filename = file.split('/').pop();
      // Determine if the file is suitable for execution based on tags

      const { unWipedScenarios, fileHasTag, tagsIncludedExcluded } =
        determineFilePropertiesBasedOnTags(file, tag);

      const envVars = await getEcsEnvVariables(runId);
      // Determine if there is a custom command
      let finalCommand;
      if (customCommand) {
        finalCommand = `timeout 2400 ${customCommand
          .replace(/%TEST_FILE\b/g, file)
          .replace(/%TEST_FILENAME\b/g, file.split('/').pop())}`.split(' ');
      } else {
        finalCommand =
          `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
            ' ',
          );
      }
      if (unWipedScenarios && fileHasTag) {
        // Send the events to ecs
        fileNames.push(filename);

        pendingEcsTasks.push(
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
          ),
        );
      }
      if (!fileHasTag && tag !== undefined)
        logger.info(
          `${filename}\n* No "${tagsIncludedExcluded.includedTags}" tag in file ${file}`,
        );

      if (!unWipedScenarios) {
        const excludedTagsList = tagsIncludedExcluded.excludedTags.join(', ');
        if (excludedTagsList) {
          logger.info(
            `* All scenarios tagged as "'${tagsIncludedExcluded.excludedTags}'" for ${filename}`,
          );
        }
      }
    }),
  );
  logger.info('Executing ' + pendingEcsTasks.length + ' tasks:');
  let counter = 0;
  for (const taskArn of await Promise.all(pendingEcsTasks)) {
    tasks.push(taskArn);
    taskDetails.push({ arn: taskArn, fileName: fileNames[counter] });
    if (typeof taskArn !== 'string') throw Error('Task ARN is not defined.');
    counter++;
  }

  async function handleTasks() {
    const timeoutTasks = [];
    if (tasks.length > 0) {
      const maxWaitTime = 1200;
      const maxDelay = 10;
      const minDelay = 5;

      try {
        // Wait for tasks to   complete

        const waitPromises = taskDetails.map(async (taskDetail) => {
          return new Promise(async (resolve) => {
            try {
              logger.info(
                `+ Executing task: ${taskDetail.arn} -> ${taskDetail.fileName}`,
              );
              const waitECSTask = await waitUntilTasksStopped(
                {
                  client: await getEcsClient(),
                  maxWaitTime: maxWaitTime,
                  maxDelay: maxDelay,
                  minDelay: minDelay,
                },
                { cluster: clusterARN, tasks: [taskDetail.arn] },
              );
              logger.info(
                `Task completed successfully ${taskDetail.arn} -> ${taskDetail.fileName}`,
              );
              resolve(waitECSTask);
            } catch (error) {
              if (error.toString().includes('TimeoutError')) {
                // Handle the timeout exception for the current task
                timeoutTasks.push({
                  taskArn: taskDetail.arn,
                  fileName: taskDetail.fileName,
                });
                logger.warning(
                  `Timeout exception occurred for task: ${taskDetail.arn} -> ${taskDetail.fileName}`,
                );
              } else {
                // Handle other types of exceptions
                logger.warning(
                  `An error occurred for task ${taskDetail} -> ${taskDetail.fileName}`,
                  {
                    error,
                  },
                );
                logger.debug(
                  `An error occurred for task ${taskDetail} -> ${
                    taskDetail.fileName
                  }, ${JSON.stringify(error)}`,
                );
              }
              setExitCode(1);
              resolve(error);
            }
          });
        });
        logger.info('Starting to poll for tasks to complete');
        await Promise.all(waitPromises);
        line();
        logger.info('All tasks completed.');
        if (timeoutTasks.length > 0) {
          logger.warning(`Timed-out tasks: ${JSON.stringify(timeoutTasks)}`);
          logger.error(
            `There were "${timeoutTasks.length}" timed out tasks after 20 minutes. Results cannot be guaranteed and thus testerloop will fail the build.`,
          );
        }
      } catch (err) {
        logger.error('Error waiting for the ecs tasks', { err });
        logger.debug('Error waiting for the ecs tasks', err);
        setExitCode(1);
      }
    }
  }

  await handleTasks();

  if (tasks.length > 0) {
    await handleResult(s3BucketName, s3RunPath, runId);
  }
}

module.exports = {
  executeEcs,
};
