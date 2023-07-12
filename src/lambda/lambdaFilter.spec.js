const { determineFilePropertiesBasedOnTags } = require('../utils/handlers');
const { findArrayDifference } = require('../utils/helper');
const logger = require('../logger/logger');

const { filterFeatureFilesByTag } = require('./lambdaFilter');
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
jest.mock('../utils/handlers');
jest.mock('../utils/helper');

describe('filterFeatureFilesByTag function', () => {
  const featureFiles = ['file1', 'file2', 'file3'];
  const tag = 'tag1';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should include files that have desired tag', async () => {
    determineFilePropertiesBasedOnTags.mockReturnValue({
      unWipedScenarios: true,
      fileHasTag: true,
    });
    findArrayDifference.mockReturnValue(['file1', 'file2']);

    const finalFiles = await filterFeatureFilesByTag(featureFiles, tag);

    expect(determineFilePropertiesBasedOnTags).toHaveBeenCalledTimes(
      featureFiles.length,
    );
    expect(findArrayDifference).toHaveBeenCalledTimes(1);
    expect(finalFiles).toEqual(['file1', 'file2']);
  });

  it('should exclude files that have all scenarios with exclusion tag', async () => {
    determineFilePropertiesBasedOnTags.mockReturnValue({
      unWipedScenarios: false,
      fileHasTag: true,
    });
    findArrayDifference.mockReturnValue(['file1', 'file2']);

    const finalFiles = await filterFeatureFilesByTag(featureFiles, tag);

    expect(finalFiles).toEqual(['file1', 'file2']);
  });

  it('should include all files when no tag is specified', async () => {
    determineFilePropertiesBasedOnTags.mockReturnValue({
      unWipedScenarios: true,
      fileHasTag: true,
    });
    findArrayDifference.mockReturnValue(featureFiles);

    const finalFiles = await filterFeatureFilesByTag(featureFiles);

    expect(finalFiles).toEqual(featureFiles);
  });
});
