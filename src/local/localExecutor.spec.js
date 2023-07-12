const { spawn } = require('child_process');

const { getInputData } = require('../utils/helper');
const { handleResult, createFinalCommand } = require('../utils/handlers');

const { executeLocal } = require('./localExecutor');
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
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../utils/handlers', () => ({
  handleResult: jest.fn(),
  createFinalCommand: jest.fn(),
}));
jest.mock('../utils/helper', () => ({
  getInputData: jest.fn(),
}));

describe('executeLocal function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute the command correctly', async () => {
    getInputData.mockResolvedValue({
      s3BucketName: 'bucket1',
      uploadFilesToS3: 'true',
      customPath: '/path',
      s3Region: 'region1',
    });

    createFinalCommand.mockResolvedValue('final command');
    handleResult.mockResolvedValue();

    const onMock = jest.fn(async (event, callback) => {
      if (event === 'close') {
        await callback();
      }
    });
    const mockChild = {
      stdout: null,
      stderr: null,
      on: jest.fn(),
    };
    spawn.mockReturnValue(mockChild);
    onMock.mockResolvedValue();

    await executeLocal('runId1', 's3RunPath1');

    expect(spawn).toHaveBeenCalledWith(
      'CYPRESS_TL_RUN_ID=runId1 CYPRESS_TL_S3_BUCKET_NAME=bucket1 CYPRESS_TL_EXECUTE_FROM=local CYPRESS_TL_CUSTOM_RESULTS_PATH=/path CYPRESS_TL_UPLOAD_RESULTS_TO_S3=true CYPRESS_TL_S3_REGION=region1 final command',
      { shell: true, stdio: 'inherit' },
    );
  });

  it('should handle result when child process closes', (done) => {
    getInputData.mockResolvedValue({
      s3BucketName: 'bucket1',
      uploadFilesToS3: 'true',
      customPath: '/path',
      s3Region: 'region1',
    });

    createFinalCommand.mockResolvedValue('final command');
    handleResult.mockResolvedValue();

    const onMock = jest.fn(async (event, callback) => {
      if (event === 'close') {
        await callback();
      }
    });
    const mockChild = {
      stdout: null,
      stderr: null,
      on: onMock,
    };
    spawn.mockReturnValue(mockChild);
    onMock.mockResolvedValue();

    executeLocal('runId1', 's3RunPath1').then(() => {
      // Force the 'close' event to trigger
      mockChild.on.mock.calls[0][1]();

      // Ensure handleResult has been called
      setImmediate(() => {
        expect(handleResult).toHaveBeenCalledWith(
          'bucket1',
          's3RunPath1',
          'runId1',
        );
        done();
      });
    });
  });
});
