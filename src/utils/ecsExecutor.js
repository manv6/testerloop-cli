const glob = require("glob");
const {
  handleResult,
  determineFilePropertiesBasedOnTags,
} = require("./handlers");
const { getEcsEnvVariables } = require("./envVariables/envVariablesHandler");
const { sendCommandToEcs, getEcsClient } = require("./taskProcessor");
const { waitUntilTasksStopped } = require("@aws-sdk/client-ecs");
const { getInputData } = require("./helper");
async function executeEcs(runId, s3RunPath) {
  const {
    specFiles,
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

  // Check if we passed one feature file or a whole folder of feature files
  let suffix = "/*.feature";
  if (specFiles.includes(".feature") === true) suffix = "";
  const files = glob.sync(`${specFiles}${suffix}`).map((file) => `${file}`);

  const tasks = [];
  const taskDetails = [];
  const fileNames = [];
  const pendingEcsTasks = [];

  await Promise.all(
    files.map(async (file) => {
      const filename = file.split("/").pop();
      // Determine if the file is suitable for execution based on tags

      const { unWipedScenarios, fileHasTag, tagsIncludedExcluded } =
        determineFilePropertiesBasedOnTags(file, tag);

      const envVars = await getEcsEnvVariables(runId);
      // Determine if there is a custom command
      let finalCommand;
      if (customCommand) {
        finalCommand = `timeout 2400 ${customCommand
          .replace(/%TEST_FILE\b/g, file)
          .replace(/%TEST_FILENAME\b/g, file.split("/").pop())}`.split(" ");
      } else {
        finalCommand =
          `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
            " "
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
            ecsPublicIp
          )
        );
      }
      if (fileHasTag === null && tag !== undefined)
        console.log(
          `${filename}\n* No "${tagsIncludedExcluded.includedTags}" tag in file ${file}`
        );
      if (!unWipedScenarios)
        console.log(
          `* All scenarios tagged as "'${tagsIncludedExcluded.excludedTags}'" for ${filename}`
        );
    })
  );
  console.log("Executing ", pendingEcsTasks.length, " tasks:");
  let counter = 0;
  for (const taskArn of await Promise.all(pendingEcsTasks)) {
    tasks.push(taskArn);
    taskDetails.push({ arn: taskArn, fileName: fileNames[counter] });
    if (typeof taskArn !== "string") throw Error("Task ARN is not defined.");
    counter++;
  }
  console.log("Task(s): ", taskDetails);

  if (tasks.length > 0) {
    // Wait for tasks to complete
    console.log("Starting to poll for tasks to complete");
    let waitECSTask;
    try {
      waitECSTask = await waitUntilTasksStopped(
        {
          client: getEcsClient(),
          maxWaitTime: 1200,
          maxDelay: 10,
          minDelay: 5,
        },
        { cluster: clusterARN, tasks }
      );
    } catch (err) {
      console.log("Error waiting for the ecs tasks", err);
    }

    console.log(`\tNumber of tasks ran: ${tasks.length}`);
    // Check if task timed out
    let timedOutContainers = [];
    waitECSTask.reason.tasks.forEach((task) => {
      const container = task.containers.find((container) => {
        return container["name"] === containerName;
      });
      if (container.exitCode === 124)
        timedOutContainers.push(container.taskArn);
    });
    if (timedOutContainers.length > 0)
      throw new Error(
        `Task(s) ${timedOutContainers} timed out and failed with exit code 124}`
      );
    // Log task names and arns
    for (let i = 0; i < taskDetails.length; i++) {
      console.log("\n");
      console.log(
        `\t${i + 1} Feature: ${taskDetails[i].fileName}, task arn: ${taskDetails[i].arn
        }`
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
