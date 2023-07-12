const { LambdaClient } = require('@aws-sdk/client-lambda');

const { getInputData } = require('../utils/helper');
const { getLogger } = require('../logger/logger');

let client;

function initializeLambdaClient(lambdaRegion) {
  const logger = getLogger();
  logger.info('Initializing lambda client');
  client = new LambdaClient({
    region: lambdaRegion,
  });
  logger.info('Lambda client initialized successfully', { client });
  return client;
}

async function getLambdaClient() {
  if (client) {
    return client;
  }

  const { lambdaRegion } = await getInputData();

  return initializeLambdaClient(lambdaRegion);
}

function clearClient() {
  client = undefined;
}

module.exports = { getLambdaClient, clearClient };
