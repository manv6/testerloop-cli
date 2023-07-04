const { LambdaClient } = require('@aws-sdk/client-lambda');

const { getInputData } = require('../utils/helper');

let client;

function initializeLambdaClient(lambdaRegion) {
  client = new LambdaClient({
    region: lambdaRegion,
  });

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
