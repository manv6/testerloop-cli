const { getInputData, wait, line } = require('../utils/helper');
const { sendTestsToLambdasBasedOnAvailableSlots, removeTestFromList, handleExecutionTimeout, checkLambdaHasTimedOut } = require('../utils/handlers');
const { checkFileExistsInS3 } = require('../s3');
const { debugThrottling } = require('../debug');
const { pollLambdasWithThrottling } = require('./lambdaPoller'); // replace with your actual module path

jest.mock('../utils/helper');
jest.mock('../utils/handlers');
jest.mock('../s3');
jest.mock('../debug');

describe('pollLambdasWithThrottling', () => {
  const defaultData = {
    lambdaTimeOutSecs: 300,
    s3BucketName: 'myBucket',
    lambdaThreads: 1,
    lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
  };

  beforeEach(() => {
    getInputData.mockResolvedValue(defaultData);
    wait.mockResolvedValue();
    line.mockImplementation(() => {});
    sendTestsToLambdasBasedOnAvailableSlots.mockResolvedValue([]);
    checkLambdaHasTimedOut.mockResolvedValue(false);
    handleExecutionTimeout.mockResolvedValue();
    checkFileExistsInS3.mockResolvedValue(false);
    debugThrottling.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return list of triggered lambda IDs and timed out lambdas', async () => {
    const allFilesToBeSent = ['test1', 'test2'];
    const envVars = {};
    const s3RunPath = 's3path';

    const { allIdsMapped, listOfLambdasWhichTimedOut } = await pollLambdasWithThrottling(allFilesToBeSent, envVars, s3RunPath);

    expect(allIdsMapped).toEqual([]);
    expect(listOfLambdasWhichTimedOut).toEqual([]);
  });

  // Add more test cases for different paths through the function based on different mocked return values
});

