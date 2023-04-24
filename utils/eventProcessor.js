const {
  LambdaClient,
  InvokeCommand,
  LogType,
  InvocationType,
} = require("@aws-sdk/client-lambda");

const client = new LambdaClient({
  region: "eu-west-3",
});

async function sendEventsToLambda(files, lambdaArn, envVariablesWithValues) {
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
              env: envVariablesWithValues,
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

module.exports = { sendEventsToLambda };
