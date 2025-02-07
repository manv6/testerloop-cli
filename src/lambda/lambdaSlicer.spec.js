const path = require('path');

const { cucumberSlicer } = require('cucumber-cypress-slicer');
const glob = require('glob');

const logger = require('../logger/logger');

const { sliceFeatureFilesRecursively } = require('./lambdaSlicer'); // replace with your actual module path
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
jest.mock('glob', () => ({ sync: jest.fn() }));
jest.mock('cucumber-cypress-slicer', () => ({ cucumberSlicer: jest.fn() }));

describe('Feature Files Slicer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sliceFeatureFilesRecursively: should find feature files and slice them', async () => {
    const specFilePath = 'cypress/e2e/overloop/site';
    const mockFeatureFiles = ['test1.feature', 'test2.feature'];
    const mockFolderPaths = ['cypress/e2e', 'cypress/e2e/subfolder'];
    const mockTransformedPaths = ['/*.feature'];

    // Mocking the returned values for each function call of glob.sync
    glob.sync
      .mockReturnValueOnce(mockFeatureFiles)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(mockFolderPaths);

    const result = await sliceFeatureFilesRecursively(specFilePath);

    // Asserting the calls to cucumberSlicer
    mockTransformedPaths.forEach((path, index) => {
      expect(cucumberSlicer).toHaveBeenNthCalledWith(
        index + 1,
        path,
        './cypress/e2e/parsed/',
      );
    });

    // Asserting the final result
    expect(result).toEqual(mockFolderPaths);
  });
});
