const { RunTaskCommand } = require('@aws-sdk/client-ecs');

const logger = require('../logger/logger');

const { getEcsClient } = require('./client');
const { sendCommandToEcs } = require('./taskProcessor'); // replace with the correct relative path to your module

jest.mock('../logger/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };
  return {
    endLogStream: jest.fn(),
    getLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

jest.mock('./client', () => ({
  getEcsClient: jest.fn(),
}));

jest.mock('@aws-sdk/client-ecs', () => ({
  RunTaskCommand: jest.fn(),
  ECSClient: jest.fn(),
}));

describe('sendCommandToEcs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEcsClient.mockClear();
  });

  it('should send command to ECS successfully', async () => {
    getEcsClient.mockResolvedValueOnce({
      send: jest.fn().mockReturnValue({ tasks: [{ taskArn: 'taskArn' }] }),
    });

    const taskArn = await sendCommandToEcs(
      'containerName',
      'runCommand',
      'clusterARN',
      'taskDefinition',
      ['subnet'],
      ['securityGroups'],
      'uploadToS3RoleArn',
      ['envVariableList'],
      'ecsPublicIp',
    );

    expect(taskArn).toBe('taskArn');
    expect(RunTaskCommand).toBeCalledWith({
      cluster: 'clusterARN',
      taskDefinition: 'taskDefinition',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: 'DISABLED',
          subnets: ['subnet'],
          securityGroups: ['securityGroups'],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'containerName',
            command: 'runCommand',
            environment: ['envVariableList'],
          },
        ],
        taskRoleArn: 'uploadToS3RoleArn',
      },
    });
  });

  it('should throw error when sending command to ECS fails', async () => {
    getEcsClient.mockRejectedValue(new Error('new error'));

    await expect(
      sendCommandToEcs(
        'containerName',
        'runCommand',
        'clusterARN',
        'taskDefinition',
        ['subnet'],
        ['securityGroups'],
        'uploadToS3RoleArn',
        ['envVariableList'],
        'ecsPublicIp',
      ),
    ).rejects.toThrow('new error');
  });
});
