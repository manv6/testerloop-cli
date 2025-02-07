const eventProcessor = require('../lambda/eventProcessor');
const s3 = require('../s3');
const logger = require('../logger/logger');

const {
  handleResult,
  checkLambdaHasTimedOut,
  removeTestFromList,
  handleExecutionTimeout,
  sendTestsToLambdasBasedOnAvailableSlots,
  getEnvVariableWithValues,
  getEnvVariableValuesFromCi,
  createFinalCommand,
  getLambdaTestResultsFromLocalBasedOnId,
  getFailedLambdaTestResultsFromLocal,
  determineFilePropertiesBasedOnTags,
} = require('./handlers');
const { clearTheArgs } = require('./argumentsParser');
const argumentsParser = require('./argumentsParser');
const helper = require('./helper');
const exitCode = require('./exitCode');
const bucketName = 'bucketName';
const runId = 'e2c9ad1b-e6e1-403f-995b-b525dc461c0f';
const orgUrl = 'https://org.com';
const s3RunPath = `bucketName/custom/e2c9ad1b-e6e1-403f-995b-b525dc461c0f`;

jest.mock('../debug', () => ({
  debugS3: jest.fn(),
  debugThrottling: jest.fn(),
  debugTags: jest.fn(),
}));
jest.mock('../s3');
jest.mock('../logger/logger', () => {
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };
  return {
    endLogStream: jest.fn(),
    silentLog: jest.fn(),
    getLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

jest.mock('./helper', () => ({
  getTestPerState: jest.fn(),
  createRunLinks: jest.fn(),
  createFailedLinks: jest.fn(),
  syncS3TestResultsToLocal: jest.fn(),
  getTestResultsFromAllFilesOnlyOnceByTestName: jest.fn(),
  getInputData: jest.fn(),
  getTestStatesPerId: jest.fn(),
  categorizeTags: jest.fn(),
  checkIfContainsTag: jest.fn(),
  checkIfAllWiped: jest.fn(),
}));

jest.mock('./exitCode', () => ({
  setExitCode: jest.fn(),
  getExitCode: jest.fn(),
}));
jest.mock('../lambda/eventProcessor', () => ({
  sendEventsToLambda: jest.fn(),
}));

jest.mock('./argumentsParser', () => ({
  clearTheArgs: jest.fn(),
}));

describe('handlers', () => {
  describe('handleResult', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should handle results for rerun and process exit code with failed tests', async () => {
      helper.getInputData.mockResolvedValue({
        reporterBaseUrl: orgUrl,
        rerun: true,
      });
      const expectedExitCode = null;

      const getTestPerStateMock = jest.fn().mockResolvedValue([
        {
          testId: 1,
          status: 'passed',
          title: 'testTitle',
          pathToTest: 'testPath',
        },
        {
          testId: 2,
          status: 'failed',
          title: 'testTitle',
          pathToTest: 'testPath',
        },
        {
          testId: 3,
          status: 'passed',
          title: 'testTitle',
          pathToTest: 'testPath',
        },
      ]);
      const failedTestResults = [
        {
          testId: 2,
          status: 'failed',
          data: 'test2-failed',
          title: 'testTitle2',
          pathToTest: 'testPath',
        },
      ];

      jest
        .spyOn(helper, 'createRunLinks')
        .mockResolvedValue(`${orgUrl}/${runId}`);

      jest.spyOn(helper, 'createFailedLinks').mockResolvedValue([]);
      jest.spyOn(exitCode, 'getExitCode').mockReturnValue(expectedExitCode);
      exitCode.setExitCode.mockReturnValue(expectedExitCode);

      jest.spyOn(s3, 'syncS3TestResultsToLocal').mockResolvedValue([]);
      jest
        .spyOn(helper, 'getTestResultsFromAllFilesOnlyOnceByTestName')
        .mockResolvedValue([
          {
            testId: 1,
            status: 'passed',
            data: 'test-passed-1',
            title: 'testTitle1',
            pathToTest: 'testPath',
          },
          {
            testId: 2,
            status: 'failed',
            data: 'test2-failed',
            title: 'testTitle2',
            pathToTest: 'testPath',
          },
          {
            testId: 3,
            status: 'passed',
            data: 'test-passed-2',
            title: 'testTitle3',
            pathToTest: 'testPath',
          },
        ]);

      await handleResult(bucketName, s3RunPath, runId);

      expect(helper.getInputData).toHaveBeenCalled();

      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);

      expect(
        helper.getTestResultsFromAllFilesOnlyOnceByTestName,
      ).toHaveBeenCalled();
      expect(getTestPerStateMock).not.toHaveBeenCalled();

      expect(helper.createFailedLinks).toHaveBeenCalledWith(
        runId,
        failedTestResults,
        orgUrl,
      );
      expect(helper.createRunLinks).toHaveBeenCalled();
      expect(exitCode.setExitCode).toHaveBeenCalledWith(1);
      expect(logger.endLogStream).toHaveBeenCalledWith();
    });

    test('should handle results for rerun and process exit code with passed tests', async () => {
      helper.getInputData.mockReturnValue({
        reporterBaseUrl: orgUrl,
        rerun: true,
      });
      const expectedExitCode = 0;
      const failedTestResults = [];

      jest
        .spyOn(helper, 'createRunLinks')
        .mockResolvedValue(`${orgUrl}/${runId}`);

      jest.spyOn(helper, 'createFailedLinks').mockResolvedValue([]);
      jest.spyOn(exitCode, 'setExitCode').mockReturnValue(expectedExitCode);

      jest.spyOn(s3, 'syncS3TestResultsToLocal').mockResolvedValue([]);
      jest
        .spyOn(helper, 'getTestResultsFromAllFilesOnlyOnceByTestName')
        .mockResolvedValue([
          { testId: 1, status: 'passed', data: 'test-passed-1' },
          { testId: 2, status: 'passed', data: 'test2-failed' },
          { testId: 3, status: 'passed', data: 'test-passed-2' },
        ]);
      jest.spyOn(helper, 'getTestPerState').mockResolvedValue([
        { testId: 1, status: 'passed' },
        { testId: 2, status: 'passed' },
        { testId: 3, status: 'passed' },
      ]);

      await handleResult(bucketName, s3RunPath, runId);

      expect(helper.getInputData).toHaveBeenCalled();

      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);

      expect(
        helper.getTestResultsFromAllFilesOnlyOnceByTestName,
      ).toHaveBeenCalled();
      expect(helper.getTestPerState).not.toHaveBeenCalled();

      expect(helper.createRunLinks).toHaveBeenCalled();
      expect(helper.createFailedLinks).not.toHaveBeenCalledWith(
        failedTestResults,
        orgUrl,
      );
      expect(exitCode.setExitCode).toHaveBeenCalledWith(expectedExitCode);
    });

    test('should handle results for single run and process exit code with failed tests', async () => {
      const failedTestResults = [
        { testId: 2, status: 'failed', data: 'test2-failed' },
      ];

      const expectedExitCode = 1;

      jest
        .spyOn(helper, 'createRunLinks')
        .mockResolvedValue(`${orgUrl}/${runId}`);

      jest.spyOn(helper, 'createFailedLinks').mockResolvedValue([]);
      helper.getInputData.mockReturnValue({
        reporterBaseUrl: orgUrl,
        rerun: false,
      });

      jest.spyOn(exitCode, 'setExitCode').mockReturnValue(expectedExitCode);
      jest.spyOn(s3, 'syncS3TestResultsToLocal').mockResolvedValue([]);
      helper.getTestPerState.mockResolvedValueOnce(failedTestResults);

      await handleResult(bucketName, s3RunPath, runId);

      expect(helper.getInputData).toHaveBeenCalled();

      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);

      expect(helper.getTestPerState).toHaveBeenCalled();
      expect(helper.getTestPerState).toHaveBeenCalledWith(
        `./logs/testResults/${s3RunPath.replace(bucketName + '/', '')}/results`,
        'testResults-',
        'failed',
      );

      expect(helper.createRunLinks).toHaveBeenCalled();
      expect(helper.createFailedLinks).toHaveBeenCalledWith(
        runId,
        failedTestResults,
        orgUrl,
      );
      expect(exitCode.setExitCode).toHaveBeenCalledWith(expectedExitCode);
    });

    test('should handle results for single run and process exit code with passed tests', async () => {
      const failedTestResults = [
        { testId: 2, status: 'failed', data: 'test2-failed' },
      ];
      const passedTestResults = [
        { testId: 2, status: 'passed', data: 'test2-passed' },
        { testId: 3, status: 'passed', data: 'test3-passed' },
      ];

      const expectedExitCode = 0;

      jest
        .spyOn(helper, 'createRunLinks')
        .mockResolvedValue(`${orgUrl}/${runId}`);

      jest.spyOn(helper, 'createFailedLinks').mockResolvedValue([]);
      helper.getInputData.mockReturnValue({
        reporterBaseUrl: orgUrl,
        rerun: false,
      });

      jest.spyOn(exitCode, 'getExitCode').mockReturnValue(expectedExitCode);
      jest.spyOn(exitCode, 'setExitCode').mockReturnValue(expectedExitCode);
      jest.spyOn(s3, 'syncS3TestResultsToLocal').mockResolvedValue([]);
      helper.getTestPerState
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(passedTestResults);

      await handleResult(bucketName, s3RunPath, runId);

      expect(helper.getInputData).toHaveBeenCalled();

      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);

      expect(helper.getTestPerState).toHaveBeenCalled();
      expect(helper.getTestPerState).toHaveBeenCalledWith(
        `./logs/testResults/${s3RunPath.replace(bucketName + '/', '')}/results`,
        'testResults-',
        'failed',
      );

      expect(helper.createRunLinks).toHaveBeenCalled();
      expect(helper.createFailedLinks).not.toHaveBeenCalledWith(
        failedTestResults,
        orgUrl,
      );
      expect(exitCode.setExitCode).toHaveBeenCalledWith(expectedExitCode);
    });
  });

  describe('checkLambdaHasTimedOut', () => {
    test('should return true if the lambda has timed out', async () => {
      const startDate = Date.now() - 5000; // 5 seconds ago
      const test = {
        tlTestId: 'test1',
        startDate,
      };
      const lambdaTimeOutSecs = 3;

      const result = await checkLambdaHasTimedOut(test, lambdaTimeOutSecs);

      expect(result).toBe(true);
    });

    test('should return false if the lambda has not timed out', async () => {
      const startDate = Date.now() - 2000; // 2 seconds ago
      const test = {
        tlTestId: 'test2',
        startDate,
      };
      const lambdaTimeOutSecs = 5;

      const result = await checkLambdaHasTimedOut(test, lambdaTimeOutSecs);

      expect(result).toBe(false);
    });
  });

  describe('removeTestFromList', () => {
    test('removes a test from the list of tests', () => {
      const listOfTests = [{ tlTestId: 1 }, { tlTestId: 2 }, { tlTestId: 3 }];
      const testToRemove = { tlTestId: 2 };
      removeTestFromList(listOfTests, testToRemove);
      expect(listOfTests).toEqual([{ tlTestId: 1 }, { tlTestId: 3 }]);
    });
  });

  describe('handleExecutionTimeout', () => {
    test('should return true if timeCounter is greater than or equal to executionTimeOutSecs, and set exit code to 1', async () => {
      const timeCounter = 10; // this value can be changed for testing
      const executionTimeOutSecs = 5; // this value can be changed for testing

      helper.getInputData.mockReturnValue({
        executionTimeOutSecs: executionTimeOutSecs,
      });

      const result = await handleExecutionTimeout(timeCounter);
      expect(result).toBe(true);
      expect(exitCode.setExitCode).toHaveBeenCalledWith(1);
    });

    test('should return false if timeCounter is less than executionTimeOutSecs, and exit code should not be set', async () => {
      const timeCounter = 3; // this value can be changed for testing
      const executionTimeOutSecs = 5; // this value can be changed for testing
      helper.getInputData.mockReturnValue({
        executionTimeOutSecs: executionTimeOutSecs,
      });

      const result = await handleExecutionTimeout(timeCounter);
      expect(result).toBe(false);
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('sendTestsToLambdasBasedOnAvailableSlots', () => {
    describe('sendTestsToLambdasBasedOnAvailableSlots', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      test('should call sendEventsToLambda with the correct arguments when availableSlots is greater than 0 and testsSentSoFar is less than allFilesToBeSent.length', async () => {
        const allFilesToBeSent = ['file1', 'file2', 'file3'];
        const availableSlots = 2;
        const testsSentSoFar = 0;
        const lambdaThreads = 4;
        const lambdaArn =
          'arn:aws:lambda:us-east-1:123456789:function:testFunction';
        const envVariables = { envVar1: 'value1', envVar2: 'value2' };
        const expectedResult = [
          {
            tlTestId: 'requestId1',
            fileName: 'file1',
            result: 'running',
            startDate: expect.any(Number),
          },
          {
            tlTestId: 'requestId2',
            fileName: 'file2',
            result: 'running',
            startDate: expect.any(Number),
          },
        ];
        const mockTempResults = [
          {
            $metadata: { requestId: 'requestId1' },
          },
          {
            $metadata: { requestId: 'requestId2' },
          },
        ];
        eventProcessor.sendEventsToLambda.mockResolvedValue(mockTempResults);

        const result = await sendTestsToLambdasBasedOnAvailableSlots(
          allFilesToBeSent,
          availableSlots,
          testsSentSoFar,
          lambdaThreads,
          lambdaArn,
          envVariables,
        );

        expect(result).toEqual(expectedResult);
        expect(eventProcessor.sendEventsToLambda).toHaveBeenCalledWith(
          ['file1', 'file2'],
          'arn:aws:lambda:us-east-1:123456789:function:testFunction',
          { envVar1: 'value1', envVar2: 'value2' },
        );
      });

      test('should return an empty array when availableSlots is 0', async () => {
        const allFilesToBeSent = ['file1', 'file2', 'file3'];
        const availableSlots = 0;
        const testsSentSoFar = 0;
        const lambdaThreads = 4;
        const lambdaArn =
          'arn:aws:lambda:us-east-1:123456789:function:testFunction';
        const envVariables = { envVar1: 'value1', envVar2: 'value2' };
        const expectedResult = [];

        const result = await sendTestsToLambdasBasedOnAvailableSlots(
          allFilesToBeSent,
          availableSlots,
          testsSentSoFar,
          lambdaThreads,
          lambdaArn,
          envVariables,
        );

        expect(result).toEqual(expectedResult);
        expect(eventProcessor.sendEventsToLambda).not.toHaveBeenCalled();
      });

      test('should return an empty array when testsSentSoFar is greater than or equal to allFilesToBeSent.length', async () => {
        const allFilesToBeSent = ['file1', 'file2'];
        const availableSlots = 2;
        const testsSentSoFar = 2;
        const lambdaThreads = 4;
        const lambdaArn =
          'arn:aws:lambda:us-east-1:123456789:function:testFunction';
        const envVariables = { envVar1: 'value1', envVar2: 'value2' };
        const expectedResult = [];

        const result = await sendTestsToLambdasBasedOnAvailableSlots(
          allFilesToBeSent,
          availableSlots,
          testsSentSoFar,
          lambdaThreads,
          lambdaArn,
          envVariables,
        );

        expect(result).toEqual(expectedResult);
        expect(eventProcessor.sendEventsToLambda).not.toHaveBeenCalled();
      });
    });
  });

  describe('getEnvVariableWithValues', () => {
    test('should return list of variables with values from given JSON', () => {
      const jsonVariables = {
        NODE_ENV: 'development',
        PORT: '3000',
      };
      const expectedOutput = [
        { name: 'NODE_ENV', value: 'development' },
        { name: 'PORT', value: '3000' },
      ];
      expect(getEnvVariableWithValues(jsonVariables)).toEqual(expectedOutput);
    });

    test('should return an error if it is not a json', () => {
      const jsonVariables = ['NODE_ENV'];
      const expectedOutput = [];
      expect(getEnvVariableWithValues(jsonVariables)).toEqual(expectedOutput);
    });

    test('should return empty list if no JSON variables are provided', () => {
      const jsonVariables = {};
      const expectedOutput = [];
      expect(getEnvVariableWithValues(jsonVariables)).toEqual(expectedOutput);
    });
  });

  describe('getEnvVariableValuesFromCi', () => {
    beforeEach(() => {
      // Mock process.env for each test
      process.env = {
        VAR_1: 'value1',
        VAR_2: 'value2',
        VAR_3: 'value3',
      };
    });

    test('should return a list of variable names and values', () => {
      const result = getEnvVariableValuesFromCi(['VAR_1', 'VAR_2', 'VAR_3']);
      expect(result).toEqual([
        { name: 'VAR_1', value: 'value1' },
        { name: 'VAR_2', value: 'value2' },
        { name: 'VAR_3', value: 'value3' },
      ]);
    });

    test('should return an empty array when no variables are provided', () => {
      const result = getEnvVariableValuesFromCi([]);
      expect(result).toEqual([]);
    });

    test('should handle undefined values', () => {
      // Set VAR_1 to undefined
      process.env.VAR_1 = undefined;
      const result = getEnvVariableValuesFromCi(['VAR_1']);
      expect(result).toEqual([{ name: 'VAR_1', value: undefined }]);
    });
  });

  describe('createFinalCommand', () => {
    test('should call clearTheArgs with the correct arguments', async () => {
      argumentsParser.clearTheArgs.mockResolvedValue([
        'cypress',
        'run',
        '--spec',
        'cypress/e2e/',
        '--browser',
        'chrome',
      ]);
      const result = await createFinalCommand();

      expect(clearTheArgs).toHaveBeenCalledWith([
        { argName: '--execute-on', hasValue: true },
        { argName: '--rerun', hasValue: false },
      ]);
      expect(result).toEqual(
        'npx cypress run --spec cypress/e2e/ --browser chrome',
      );
    });

    test('should return the expected final command for local', async () => {
      argumentsParser.clearTheArgs.mockResolvedValue([
        'cypress',
        'run',
        '--spec',
        'cypress/e2e/',
        '--browser',
        'chrome',
      ]);
      const result = await createFinalCommand();
      expect(result).toEqual(
        'npx cypress run --spec cypress/e2e/ --browser chrome',
      );
    });

    test('should return the expected final command for local rerun', async () => {
      argumentsParser.clearTheArgs.mockResolvedValue([
        'cucumber-cypress-rerun',
        '--feature-files',
        'cypress/e2e/overloop/',
        '--env',
        'TAGS=@overloop',
        '--browser',
        'chrome',
        '--spec',
        'cypress/e2e/overloop',
      ]);
      const result = await createFinalCommand();
      expect(result).toEqual(
        'npx cucumber-cypress-rerun --feature-files cypress/e2e/overloop/ --env TAGS=@overloop --browser chrome --spec cypress/e2e/overloop',
      );
    });
  });

  describe('getLambdaTestResultsFromLocalBasedOnId', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return an empty array when no results are found', async () => {
      const bucket = 'your-bucket-name';
      const listOfTestIdsToCheckResults = ['test-id-1', 'test-id-2'];
      const expectedResults = [];
      helper.getTestStatesPerId.mockResolvedValueOnce([]);
      const results = await getLambdaTestResultsFromLocalBasedOnId(
        bucket,
        listOfTestIdsToCheckResults,
        s3RunPath,
      );

      expect(results).toEqual(expectedResults);
    });

    test('should return an object with the test results', async () => {
      const bucket = 'your-bucket-name';
      const listOfTestIdsToCheckResults = ['test-id-1', 'test-id-2'];
      const expectedResults = [
        { testId: 'test-id-1', data: 'test1' },
        { testId: 'test-id-2', data: 'test2' },
      ];
      helper.getTestStatesPerId.mockResolvedValue([
        { testId: 'test-id-1', data: 'test1' },
        { testId: 'test-id-2', data: 'test2' },
      ]);
      const results = await getLambdaTestResultsFromLocalBasedOnId(
        bucket,
        listOfTestIdsToCheckResults,
        s3RunPath,
      );

      expect(results).toEqual(expectedResults);
      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);
    });

    test('should catch error when unable to retrieve results from s3', async () => {
      const bucket = 'test-bucket';
      const listOfTestIdsToCheckResults = ['test-id-1', 'test-id-2'];
      s3.syncS3TestResultsToLocal.mockRejectedValueOnce(
        new Error('Failed to fetch data from s3'),
      );

      await getLambdaTestResultsFromLocalBasedOnId(
        bucket,
        listOfTestIdsToCheckResults,
        s3RunPath,
      );

      expect(s3.syncS3TestResultsToLocal).toHaveBeenCalledWith(s3RunPath);
      expect(exitCode.setExitCode).toHaveBeenCalledWith(1);
    });
  });

  describe('getFailedLambdaTestResultsFromLocal', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test('should return an array of file paths for failed tests', async () => {
      const bucketName = 'my-bucket';
      const failedTestResults = [
        { pathToTest: 'cypress/e2e/parsed/failing_test1.js' },
        { pathToTest: 'cypress/e2e/parsed/failing_test2.js' },
      ];
      exitCode.setExitCode.mockReturnValue();
      s3.syncS3TestResultsToLocal.mockResolvedValueOnce(s3RunPath);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      helper.getTestPerState.mockResolvedValueOnce(failedTestResults);

      const result = await getFailedLambdaTestResultsFromLocal(
        bucketName,
        s3RunPath,
      );

      expect(result).toEqual(['failing_test1.js', 'failing_test2.js']);
      expect(exitCode.setExitCode).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith(
        'Could not retrieve results from s3',
      );
    });

    test('should set exit code to 1 and log an error message if unable to fetch results from s3', async () => {
      const bucketName = 'bucketName';

      helper.getTestPerState.mockResolvedValueOnce([]);
      // @TODO same
      // jest.spyOn(console, 'log').mockImplementation(() => {});
      s3.syncS3TestResultsToLocal.mockRejectedValueOnce(
        new Error('Unable to fetch results'),
      );

      await getFailedLambdaTestResultsFromLocal(bucketName, s3RunPath);

      expect(exitCode.setExitCode).toHaveBeenCalledWith(1);
      // expect(console.log).toHaveBeenCalledWith(
      //   'Could not retrieve results from s3',
      // );
    });
  });

  describe('determineFilePropertiesBasedOnTags', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Case 1: No tag is provided, should return true (process all files)', () => {
      const file = 'file.feature';
      const tag = undefined;
      const expected = true;
      const result = determineFilePropertiesBasedOnTags(file, tag);
      expect(result).toEqual(expected);
    });

    test('Case 2: File contains the provided included tag, should return true', () => {
      const file = 'file.feature';
      const tag = '@tag1';
      helper.categorizeTags.mockReturnValue({
        includedTags: ['@tag1'],
        excludedTags: [],
      });
      helper.checkIfContainsTag.mockReturnValue(true);
      const expected = true;
      const result = determineFilePropertiesBasedOnTags(file, tag);
      expect(result).toEqual(expected);
    });

    test('Case 3: File does not contain the provided included tag, should return false', () => {
      const file = 'file.feature';
      const tag = '@tag2';
      helper.categorizeTags.mockReturnValue({
        includedTags: ['@tag2'],
        excludedTags: [],
      });
      helper.checkIfContainsTag.mockReturnValue(false);
      const expected = false;
      const result = determineFilePropertiesBasedOnTags(file, tag);
      expect(result).toEqual(expected);
    });

    test('Case 4: File contains excluded tag that wipes all scenarios, should return false', () => {
      const file = 'file.feature';
      const tag = 'not @excluded';
      helper.categorizeTags.mockReturnValue({
        includedTags: [],
        excludedTags: ['@excluded'],
      });
      helper.checkIfAllWiped.mockReturnValue(true);
      const expected = false;
      const result = determineFilePropertiesBasedOnTags(file, tag);
      expect(result).toEqual(expected);
    });

    test('Case 5: File contains included tags and is not wiped by excluded tags, should return true', () => {
      const file = 'file.feature';
      const tag = '@tag4 and not @exclude';
      helper.categorizeTags.mockReturnValue({
        includedTags: ['@tag4'],
        excludedTags: ['@excluded'],
      });
      helper.checkIfContainsTag.mockReturnValue(true);
      helper.checkIfAllWiped.mockReturnValue(false);
      const expected = true;
      const result = determineFilePropertiesBasedOnTags(file, tag);
      expect(result).toEqual(expected);
    });
  });
});
