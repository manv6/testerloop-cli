const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");

const { getEcsClient } = require("./client");

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
  return new Promise(async (resolve, reject) => {
    try {
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
      const ecsTask = await (await getEcsClient()).send(runTaskCommand);
      const { taskArn } = ecsTask.tasks[0];
      resolve(taskArn);
    } catch(e) {
      reject(e);
    }
  });
}

module.exports = { sendCommandToEcs };
