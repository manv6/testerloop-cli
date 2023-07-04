const { ECSClient } = require('@aws-sdk/client-ecs');

const { getInputData } = require('../utils/helper');

const { getEcsClient, clearClient } = require('./client');

jest.mock('../utils/helper', () => ({ getInputData: jest.fn() }));
jest.mock('@aws-sdk/client-ecs', () => ({ ECSClient: jest.fn() }));

describe('ECS Client', () => {
  const ecsClientInstance = {};
  const ecsRegion = 'us-west-2';
  beforeEach(() => {
    jest.clearAllMocks();
    clearClient();
  });

  test('getEcsClient: should return existing client if already initialized', async () => {
    getInputData.mockReturnValue({ ecsRegion });

    const client1 = await getEcsClient();
    const client2 = await getEcsClient();

    expect(client1).toBe(client2);
    expect(getInputData).toHaveBeenCalledTimes(1);
  });

  test('getEcsClient: should initialize and return new client if not already initialized', async () => {
    getInputData.mockReturnValue({ ecsRegion });
    ECSClient.mockReturnValue(ecsClientInstance);

    const client = await getEcsClient();

    expect(client).toEqual(ecsClientInstance);
    expect(getInputData).toHaveBeenCalledTimes(1);
  });
});
