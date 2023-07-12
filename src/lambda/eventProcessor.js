const {
  InvokeCommand,
  LogType,
  InvocationType,
} = require('@aws-sdk/client-lambda');

const { getLogger } = require('../logger/logger');

const { getLambdaClient } = require('./client');

async function sendEventsToLambda(files, lambdaArn, envVars) {
  const logger = getLogger();
  const client = await getLambdaClient();

  return new Promise(async (resolve) => {
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const command = new InvokeCommand({
            FunctionName: lambdaArn,
            InvocationType: InvocationType.Event,
            Payload: JSON.stringify({
              spec: file,
              envVars,
            }),
            LogType: LogType.Tail,
          });
          return await client.send(command);
        }),
      );
      resolve(results);
    } catch (error) {
      logger.error('ERROR: could not send events', { error });
      logger.debug('ERROR: could not send events', error);
      resolve();
    }
  });
}

module.exports = { sendEventsToLambda };
