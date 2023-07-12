const { S3Client } = require('@aws-sdk/client-s3');

const { getInputData } = require('../utils/helper');

const { getS3Client, clearClient } = require('./client');

jest.mock('@aws-sdk/client-s3');
jest.mock('../utils/helper');
jest.mock('../logger/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };
  return {
    getLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

const mockS3Region = 'us-west-2';
const mockClient = { region: mockS3Region };

describe('S3 Client', () => {
  beforeEach(() => {
    clearClient();
    jest.clearAllMocks();
    getInputData.mockResolvedValue({ s3Region: mockS3Region });
    S3Client.mockReturnValue(mockClient);
  });

  test('should create a new S3Client with the region from getInputData if no client is currently initialized', async () => {
    const client = await getS3Client();

    expect(client).toEqual(mockClient);
    expect(S3Client).toHaveBeenCalledTimes(1);
    expect(S3Client).toHaveBeenCalledWith({ region: mockS3Region });
  });

  test('should return an already initialized S3Client', async () => {
    const firstCallClient = await getS3Client();
    const secondCallClient = await getS3Client();
    expect(secondCallClient).toBe(firstCallClient);
    expect(S3Client).toHaveBeenCalledTimes(1);
  });
});
