const glob = require("glob");
const { handleResult, getInputData } = require("./handlers");
const { sendCommandToEcs, ecsClient } = require("./taskProcessor");
const { checkIfAllWipped, checkIfContainsTag } = require("./helper");
const { waitUntilTasksStopped } = require("@aws-sdk/client-ecs");

async function executeEcs() {
  const {
    specFiles,
    tag,
    containerName,
    clusterARN,
    taskDefinition,
    subnets,
    securityGroups,
    uploadToS3RoleArn,
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
      fileNames.push(filename);
      const fileHasTag =
        tag !== undefined ? checkIfContainsTag(file, tag) : false;
      const unwippedScenarios = checkIfAllWipped(file, tag);

      const cypressCommand =
        `timeout 2400 npx cypress run --browser chrome --spec ${file}`.split(
          " "
        );
      const finalCommand = cypressCommand;
      if (unwippedScenarios && (fileHasTag || tag === undefined)) {
        // Send the events to ecs
        pendingEcsTasks.push(
          sendCommandToEcs(
            containerName,
            finalCommand,
            clusterARN,
            taskDefinition,
            subnets,
            securityGroups,
            uploadToS3RoleArn
          )
        );
      }
      if (fileHasTag === null && tag !== undefined)
        console.log(`${filename}\nno ${tag} tag in file ${file}`);
      if (!unwippedScenarios)
        console.log(`All scenarios tagged as '${tag}' for ${filename}`);
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
    const waitECSTask = await waitUntilTasksStopped(
      { client: ecsClient, maxWaitTime: 3000, maxDelay: 20, minDelay: 10 },
      { cluster: clusterARN, tasks }
    );
    console.log("wait for tasks to finish", waitECSTask);
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
        `\t${i + 1} Feature: ${taskDetails[i].fileName}, task arn: ${
          taskDetails[i].arn
        }`
      );
    }
  }
  if (tasks.length > 0) {
    await handleResult();
  }
}

module.exports = {
  executeEcs,
};
