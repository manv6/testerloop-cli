const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const S3SyncClient = require('s3-sync-client');

const {
  syncS3TestResultsToLocal,
  uploadJSONToS3,
  checkFileExistsInS3,
} = require('../s3'); // change to your actual module path
const logger = require('../logger/logger');

const { getS3Client } = require('./client');

jest.mock('../logger/logger', () => {
  return { getLogger: jest.fn() };
});
jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));
jest.mock('s3-sync-client');
jest.mock('./client');

describe('S3 operations', () => {
  beforeEach(() => {
    jest
      .spyOn(logger, 'getLogger')
      .mockReturnValue({ error: jest.fn(), debug: jest.fn(), info: jest.fn() });
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should sync files from S3 to local path', async () => {
    const sync = jest.fn();
    S3SyncClient.mockReturnValueOnce({ sync });
    getS3Client.mockResolvedValueOnce({});

    await syncS3TestResultsToLocal('s3path', 'localPath');
    expect(sync).toHaveBeenCalledWith('s3://s3path/results', 'localPath');
  });

  it('should upload JSON file to S3', async () => {
    const send = jest.fn();
    getS3Client.mockResolvedValueOnce({ send });
    PutObjectCommand.mockReturnValueOnce({});

    await uploadJSONToS3('bucket', 's3RunPath', { test: 'data' });
    expect(send).toHaveBeenCalled();
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 's3RunPath/logs/cicd.json',
      Body: JSON.stringify({ test: 'data' }),
    });
  });

  it('should check if a file exists in S3', async () => {
    const send = jest.fn().mockResolvedValueOnce(true);
    getS3Client.mockResolvedValueOnce({ send });
    HeadObjectCommand.mockReturnValueOnce({});

    const result = await checkFileExistsInS3('bucketName', 'key');
    expect(send).toHaveBeenCalled();
    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucketName',
      Key: 'key',
    });
    expect(result).toEqual(true);
  });

  it('should return false if file does not exist in S3', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('Not found'));
    getS3Client.mockResolvedValueOnce({ send });
    HeadObjectCommand.mockReturnValueOnce({});

    const result = await checkFileExistsInS3('bucketName', 'key');
    expect(send).toHaveBeenCalled();
    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucketName',
      Key: 'key',
    });
    expect(result).toBeUndefined();
  });
});
