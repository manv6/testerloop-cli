const {
  ECSClient,
  RunTaskCommand,
  waitUntilTasksStopped,
} = require("@aws-sdk/client-ecs");
const { getRunId } = require("../utils/helper");

const ecsClient = new ECSClient("eu-west-3");

const launchType = "FARGATE";
const assignPublicIp = "ENABLED";

async function sendCommandToEcs(
  containerName,
  runCommand,
  clusterARN,
  taskDefinition,
  subnets,
  securityGroups,
  uploadToS3RoleArn,
  envVariableList
) {
  return new Promise(async (resolve) => {
    const overrides = [{ name: containerName, command: runCommand }];
    overrides[0].environment = envVariableList;

    const runTaskCommand = new RunTaskCommand({
      cluster: clusterARN,
      taskDefinition,
      launchType,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp,
          subnets,
          securityGroups,
        },
      },
      overrides: {
        containerOverrides: overrides,
        taskRoleArn: uploadToS3RoleArn,
      },
    });
    const ecsTask = await ecsClient.send(runTaskCommand);
    const { taskArn } = ecsTask.tasks[0];
    resolve(taskArn);
  });
}

module.exports = { sendCommandToEcs, ecsClient };
