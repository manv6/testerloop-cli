const {
  LambdaClient,
  InvokeCommand,
  LogType,
  InvocationType,
} = require("@aws-sdk/client-lambda");

let client;

function initializeLambdaClient(lambdaRegion) {
  client = new LambdaClient({
    region: lambdaRegion,
  });
}

async function sendEventsToLambda(files, lambdaArn, envVars) {
  return new Promise(async (resolve) => {
    try {
      let command;
      const results = await Promise.all(
        files.map(async (file) => {
          command = new InvokeCommand({
            FunctionName: lambdaArn,
            InvocationType: InvocationType.Event,
            Payload: JSON.stringify({
              spec: file.split("/").pop(),
              envVars,
            }),
            LogType: LogType.Tail,
          });
          return await client.send(command);
        })
      );
      resolve(results);
    } catch (error) {
      console.log("ERROR: could not send events", error);
    }
  });
}

module.exports = { sendEventsToLambda, initializeLambdaClient };
