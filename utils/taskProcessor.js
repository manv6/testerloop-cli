const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");

let ecsClient;

function initializeECSClient(ecsRegion) {
  ecsClient = new ECSClient(ecsRegion);
}

function getEcsClient() {
  return ecsClient;
}

const launchType = "FARGATE";
let assignPublicIp = "DISABLED";

async function sendCommandToEcs(
  containerName,
  runCommand,
  clusterARN,
  taskDefinition,
  subnets,
  securityGroups,
  uploadToS3RoleArn,
  envVariableList,
  ecsPublicIp
) {
  return new Promise(async (resolve) => {
    assignPublicIp =
      ecsPublicIp === "ENABLED" ? (assignPublicIp = "ENABLED") : assignPublicIp;
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

module.exports = { sendCommandToEcs, getEcsClient, initializeECSClient };
