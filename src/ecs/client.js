const { ECSClient } = require('@aws-sdk/client-ecs');

const { getInputData } = require('../utils/helper');

let client;

function initializeECSClient(ecsRegion) {
  client = new ECSClient(ecsRegion);

  return client;
}

async function getEcsClient() {
  if (client) {
    return client;
  }

  const { ecsRegion } = await getInputData();

  return initializeECSClient(ecsRegion);
}

function clearClient() {
  client = undefined;
}

module.exports = { getEcsClient, clearClient };
