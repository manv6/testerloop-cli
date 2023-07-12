const glob = require('glob');
const { waitUntilTasksStopped } = require('@aws-sdk/client-ecs');

const {
  handleResult,
  determineFilePropertiesBasedOnTags,
} = require('../utils/handlers');
const {
  getEcsEnvVariables,
} = require('../utils/envVariables/envVariablesHandler');
const { getInputData } = require('../utils/helper');
const { getLogger } = require('../logger/logger');

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
  let suffix = '/*.feature';
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
      if (unWipedScenarios && (fileHasTag || tag === undefined)) {
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
      if (fileHasTag === null && tag !== undefined)
        logger.info(
          `${filename}\n* No "${tagsIncludedExcluded.includedTags}" tag in file ${file}`,
        );

      if (!unWipedScenarios)
        logger.info(
          `* All scenarios tagged as "'${tagsIncludedExcluded.excludedTags}'" for ${filename}`,
        );
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
  logger.info(`Task(s):  ${tasks}`, {
    taskDetails,
  });

  if (tasks.length > 0) {
    // Wait for tasks to   complete
    logger.info('Starting to poll for tasks to complete');
    let waitECSTask;
    try {
      waitECSTask = await waitUntilTasksStopped(
        {
          client: await getEcsClient(),
          maxWaitTime: 1200,
          maxDelay: 10,
          minDelay: 5,
        },
        { cluster: clusterARN, tasks },
      );
    } catch (err) {
      logger.error('Error waiting for the ecs tasks', { err });
      logger.debug('Error waiting for the ecs tasks', err);
    }

    logger.info(`\tNumber of tasks ran: ${tasks.length}`);
    // Check if task timed out
    let timedOutContainers = [];
    waitECSTask.reason.tasks.forEach((task) => {
      const container = task.containers.find((container) => {
        return container['name'] === containerName;
      });
      if (container.exitCode === 124)
        timedOutContainers.push(container.taskArn);
    });
    if (timedOutContainers.length > 0)
      throw new Error(
        `Task(s) ${timedOutContainers} timed out and failed with exit code 124}`,
      );
    // Log task names and arns
    for (let i = 0; i < taskDetails.length; i++) {
      logger.info(
        `\t${i + 1} Feature: ${taskDetails[i].fileName}, task arn: ${
          taskDetails[i].arn
        }`,
      );
    }
  }
  if (tasks.length > 0) {
    await handleResult(s3BucketName, s3RunPath, runId);
  }
}

module.exports = {
  executeEcs,
};
