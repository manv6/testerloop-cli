const glob = require('glob');
const { waitUntilTasksStopped } = require('@aws-sdk/client-ecs');
const { getInputData } = require('../utils/helper');
const { getEcsEnvVariables } = require('../utils/envVariables/envVariablesHandler');
const { sendCommandToEcs } = require('./taskProcessor');
const { getEcsClient } = require('./client');
const { handleResult, determineFilePropertiesBasedOnTags } = require('../utils/handlers');
const { executeEcs } = require('./ecsExecutor'); 

jest.mock('glob', () => ({sync: jest.fn()}));
jest.mock('@aws-sdk/client-ecs', () => ({
  waitUntilTasksStopped: jest.fn()
}));
jest.mock('../utils/helper', () => ({
  getInputData: jest.fn()
}));
jest.mock('../utils/envVariables/envVariablesHandler', () => ({
  getEcsEnvVariables: jest.fn()
}));
jest.mock('./taskProcessor', () => ({
  sendCommandToEcs: jest.fn()
}));
jest.mock('./client', () => ({
  getEcsClient: jest.fn()
}));
jest.mock('../utils/handlers', () => ({
  handleResult: jest.fn(),
  determineFilePropertiesBasedOnTags: jest.fn()
}));

describe('executeEcs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute ECS successfully', async () => {
    // Mock functions
    glob.sync.mockReturnValue(['file1', 'file2']);
    getInputData.mockResolvedValue({
      specFilesPath: './specs',
      tag: 'tag1',
      containerName: 'containerName',
      clusterARN: 'clusterARN',
      taskDefinition: 'taskDefinition',
      subnets: ['subnet'],
      securityGroups: ['securityGroup'],
      uploadToS3RoleArn: 'uploadToS3RoleArn',
      s3BucketName: 's3BucketName',
      customCommand: 'customCommand',
      ecsPublicIp: 'ecsPublicIp',
    });
    determineFilePropertiesBasedOnTags.mockReturnValue({ unWipedScenarios: true, fileHasTag: true });
    getEcsEnvVariables.mockResolvedValue(['envVar']);
    sendCommandToEcs.mockResolvedValue('taskArn');
    getEcsClient.mockResolvedValue({});
    waitUntilTasksStopped.mockResolvedValue({ reason: { tasks: [{ containers: [{ name: 'containerName', exitCode: 0 }] }] } });

    // Execute function
    await executeEcs('runId', 's3RunPath');

    // Verify that functions were called with the correct parameters
    expect(glob.sync).toHaveBeenCalledWith('./specs/*.feature');
    expect(determineFilePropertiesBasedOnTags).toHaveBeenCalledWith('file1', 'tag1');
    expect(determineFilePropertiesBasedOnTags).toHaveBeenCalledWith('file2', 'tag1');
    expect(getEcsEnvVariables).toHaveBeenCalledWith('runId');
    expect(sendCommandToEcs).toHaveBeenCalledTimes(2);
    expect(waitUntilTasksStopped).toHaveBeenCalled();
    expect(handleResult).toHaveBeenCalledWith('s3BucketName', 's3RunPath', 'runId');
  });

  it('should throw an error when taskArn is not a string', async () => {
    // Mock functions
    glob.sync.mockReturnValue(['file1']);
    getInputData.mockResolvedValue({
      specFilesPath: './specs',
      tag: 'tag1',
      containerName: 'containerName',
      clusterARN: 'clusterARN',
      taskDefinition: 'taskDefinition',
      subnets: ['subnet'],
      securityGroups: ['securityGroup'],
      uploadToS3RoleArn: 'uploadToS3RoleArn',
      s3BucketName: 's3BucketName',
      customCommand: 'customCommand',
      ecsPublicIp: 'ecsPublicIp',
    });
    determineFilePropertiesBasedOnTags.mockReturnValue({ unWipedScenarios: true, fileHasTag: true });
    getEcsEnvVariables.mockResolvedValue(['envVar']);
    sendCommandToEcs.mockResolvedValue({});

    // Expect function to throw an error
    await expect(executeEcs('runId', 's3RunPath')).rejects.toThrow('Task ARN is not defined.');

    // Verify that functions were called with the correct parameters
    expect(glob.sync).toHaveBeenCalledWith('./specs/*.feature');
    expect(determineFilePropertiesBasedOnTags).toHaveBeenCalledWith('file1', 'tag1');
    expect(getEcsEnvVariables).toHaveBeenCalledWith('runId');
    expect(sendCommandToEcs).toHaveBeenCalledTimes(1);
  });
});
