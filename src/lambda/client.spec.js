const { LambdaClient } = require('@aws-sdk/client-lambda');

const { getInputData } = require('../utils/helper');

const { getLambdaClient, clearClient } = require('./client');

jest.mock('../utils/helper', () => ({ getInputData: jest.fn() }));
jest.mock('@aws-sdk/client-lambda', () => ({ LambdaClient: jest.fn() }));

describe('Lambda Client', () => {
  const lambdaClientInstance = {};
  const lambdaRegion = 'us-west-2';
  beforeEach(() => {
    jest.clearAllMocks();
    clearClient();
  });

  test('getLambdaClient: should return existing client if already initialized', async () => {
    getInputData.mockReturnValue({ lambdaRegion });

    const client1 = await getLambdaClient();
    const client2 = await getLambdaClient();

    expect(client1).toBe(client2);
    expect(LambdaClient).toHaveBeenCalledTimes(1);
    expect(LambdaClient).toHaveBeenCalledWith({ region: lambdaRegion });
    expect(getInputData).toHaveBeenCalledTimes(1);
  });

  test('getLambdaClient: should initialize and return new client if not already initialized', async () => {
    getInputData.mockReturnValue({ lambdaRegion });
    LambdaClient.mockReturnValue(lambdaClientInstance);

    const client = await getLambdaClient();

    expect(client).toEqual(lambdaClientInstance);
    expect(getInputData).toHaveBeenCalledTimes(1);
  });
});
