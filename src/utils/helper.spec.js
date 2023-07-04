const fs = require('fs');
const {
  wait,
  getS3RunPath,
  findArrayDifference,
  findArrayUnion,
  getNewRunId,
  getExitCode,
  setExitCode,
  getOrgUrl,
  clearFeaturePath,
  extractTags,
  getNonCommonElements,
  categorizeTags,
  checkIfContainsTag,
  checkIfAllWiped,
} = require('./helper');

jest.mock('uuid', () => ({
  v4: () => '123e4567-e89b-12d3-a456-426614174000',
}));
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('fs-extra', () => ({ native: jest.fn() }));

describe('wait function', () => {
  jest.useFakeTimers();

  it('Should resolve after the specified amount of time', () => {
    const promise = wait(5000);
    jest.advanceTimersByTime(5000);
    return expect(promise).resolves.toBeUndefined();
  });
});

describe('getS3RunPath function', () => {
  it('Should return valid S3 path with no extra slashes', () => {
    expect(getS3RunPath('bucketName', 'customPath', 'runId')).toBe('bucketName/customPath/runId');
    expect(getS3RunPath('bucketName/', '/customPath/', '/runId')).toBe('bucketName/customPath/runId');
  });
});

describe('Array helper functions', () => {
  it('findArrayDifference function should return correct differences', () => {
    const array1 = [1, 2, 3, 4, 5];
    const array2 = [4, 5, 6, 7, 8];
    expect(findArrayDifference(array1, array2)).toEqual([1, 2, 3]);
  });

  it('findArrayUnion function should return correct union', () => {
    const array1 = [1, 2, 3, 4, 5];
    const array2 = [4, 5, 6, 7, 8];
    expect(findArrayUnion(array1, array2)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('UUID related functions', () => {
  it('getNewRunId should return a new run id', () => {
    expect(getNewRunId()).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('getExitCode and setExitCode should work correctly together', () => {
    setExitCode(100);
    expect(getExitCode()).toBe(100);
  });
});

describe('URL and path related functions', () => {
  it('getOrgUrl should remove the trailing slash if present', () => {
    expect(getOrgUrl('http://example.com/')).toBe('http://example.com');
    expect(getOrgUrl('http://example.com')).toBe('http://example.com');
  });

  it('clearFeaturePath should return the file name from a path', () => {
    expect(clearFeaturePath('path/to/file.txt')).toBe('file.txt');
  });
});

describe('Tag related functions', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  });
  it('extractTags should return an array of tags from the string', () => {
    expect(extractTags('run @tag1 @tag2 @tag3')).toEqual(['@tag1', '@tag2', '@tag3']);
  });

  it('getNonCommonElements should return non common elements from two arrays', () => {
    expect(getNonCommonElements([1, 2, 3], [3, 4, 5])).toEqual([1, 2, 4, 5]);
  });

  it('categorizeTags should separate included and excluded tags', () => {
    expect(categorizeTags('@include not @exclude')).toEqual({ includedTags: ['@include'], excludedTags: ['@exclude'] });
  });

  it('checkIfContainsTag should check if a file contains a tag', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce('@tag1 @tag2');
    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce('@tag2');

    expect(checkIfContainsTag('@tag1', '@tag1 @tag2')).toBe(true);
    expect(checkIfContainsTag('@tag3', '@tag1 @tag2')).toBe(false);
  });

  it('checkIfAllWiped should return true if all features are wiped', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue("@tag\nScenario: ScenarioOutline:");
    expect(checkIfAllWiped('', '@wiped')).toBe(true);
    expect(checkIfAllWiped('', '@tag')).toBe(false);
  });
});

