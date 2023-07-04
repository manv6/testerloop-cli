const { getInputData } = require('../utils/helper');
const {
  handleResult,
  getLambdaTestResultsFromLocalBasedOnId,
  getFailedLambdaTestResultsFromLocal,
} = require('../utils/handlers');

const { executeLambdas } = require('./lambdaExecutor');
const { pollLambdasWithThrottling } = require('./lambdaPoller');
const { sliceFeatureFilesRecursively } = require('./lambdaSlicer');

jest.mock('../utils/helper');
jest.mock('./lambdaPoller');
jest.mock('./lambdaSlicer');
jest.mock('./lambdaFilter');
jest.mock('../utils/envVariables/envVariablesHandler');
jest.mock('../utils/handlers');

describe('executeLambdas function', () => {
  const runId = 'run1';
  const s3RunPath = '/path/to/s3';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process lambdas and handle result when no timeouts or failures occur', async () => {
    getInputData.mockResolvedValue({ rerun: false });
    pollLambdasWithThrottling.mockResolvedValue({
      listOfLambdasWhichTimedOut: [],
    });
    getFailedLambdaTestResultsFromLocal.mockResolvedValue([]);

    await executeLambdas(runId, s3RunPath);

    expect(getInputData).toHaveBeenCalledTimes(1);
    expect(pollLambdasWithThrottling).toHaveBeenCalledTimes(1);
    expect(getFailedLambdaTestResultsFromLocal).toHaveBeenCalledTimes(1);
    expect(handleResult).toHaveBeenCalledTimes(1);
  });

  it('should process lambdas and handle rerun when there are timeouts or failures', async () => {
    getLambdaTestResultsFromLocalBasedOnId.mockResolvedValue([
      { status: 'failed' },
    ]);
    getInputData.mockResolvedValue({ rerun: true });
    pollLambdasWithThrottling
      .mockResolvedValueOnce({ listOfLambdasWhichTimedOut: ['lambda1'] })
      .mockResolvedValueOnce({ listOfLambdasWhichTimedOut: [] });
    getFailedLambdaTestResultsFromLocal.mockResolvedValue(['failedTest1']);

    const processSpy = jest.spyOn(process, 'exit');
    processSpy.mockImplementation(() => {});

    await executeLambdas(runId, s3RunPath);

    expect(getInputData).toHaveBeenCalledTimes(1);
    expect(pollLambdasWithThrottling).toHaveBeenCalledTimes(2);
    expect(getFailedLambdaTestResultsFromLocal).toHaveBeenCalledTimes(1);
    expect(handleResult).not.toHaveBeenCalled(); // It should not be called in this case

    processSpy.mockRestore();
  });
});
