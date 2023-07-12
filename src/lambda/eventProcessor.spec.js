const logger = require('../logger/logger');

const { sendEventsToLambda } = require('./eventProcessor');
const { getLambdaClient } = require('./client');

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
}); // Here, we only mock getLambdaClient function and avoid using mockImplementation
jest.mock('./client');

describe('sendEventsToLambda function', () => {
  const files = ['file1', 'file2'];
  const lambdaArn =
    'arn:aws:lambda:us-west-2:123456789012:function:my-function';
  const envVars = { var1: 'value1', var2: 'value2' };
  const mockLambdaResponse = { StatusCode: 200 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should invoke the Lambda function with correct parameters', async () => {
    const mockSend = jest.fn().mockResolvedValue(mockLambdaResponse);
    getLambdaClient.mockResolvedValue({ send: mockSend });

    const result = await sendEventsToLambda(files, lambdaArn, envVars);

    expect(getLambdaClient).toHaveBeenCalledTimes(1);
    expect(result).toEqual([mockLambdaResponse, mockLambdaResponse]);

    // Here, we check if the send function was called with an object of expected shape
    result.forEach((res, index) => {
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            FunctionName: lambdaArn,
            InvocationType: 'Event',
            Payload: JSON.stringify({
              spec: files[index],
              envVars,
            }),
            LogType: 'Tail',
          },
        }),
      );
    });
  });

  it('should handle errors gracefully', async () => {
    const mockSend = jest.fn().mockResolvedValue(mockLambdaResponse);
    getLambdaClient.mockResolvedValue({ send: mockSend });
    const errorMessage = 'Test error';
    // Mock the send function to reject with an error
    mockSend.mockRejectedValue(Error(errorMessage));

    await sendEventsToLambda(files, lambdaArn, envVars);
  });
});
