const path = require('path');

const { cucumberSlicer } = require('cucumber-cypress-slicer');
const glob = require('glob');

function findFeatureFilesRecursively(directory) {
  const featureFiles = [];

  const processFolder = (folderPath) => {
    const files = glob.sync(path.join(folderPath, '*.feature')) || [];
    featureFiles.push(...files);

    const subfolders = glob.sync(path.join(folderPath, '*/')) || [];

    for (const subfolder of subfolders) {
      processFolder(subfolder);
    }
  };

  processFolder(directory);

  return featureFiles;
}

async function sliceFeatureFilesRecursively(specFilePath) {
  // Find all the feature files in the given directory and its subfolders
  const featureFilesToSplit = [];
  let filesToExecute = findFeatureFilesRecursively(specFilePath);
  // Replace the feature file names with a * pattern and put in a unique set
  for (const fileWithName of filesToExecute) {
    const segments = fileWithName.split('/');
    segments.pop();
    const transformedString = segments.join('/') + '/*.feature';
    featureFilesToSplit.push(transformedString);
  }
  const uniqueFeaturesPatternArray = [...new Set(featureFilesToSplit)];

  // Refactor to accept multiple files
  // Slice the found feature files to create the parsed files
  for (let patternToSlice of uniqueFeaturesPatternArray) {
    await cucumberSlicer(patternToSlice, `./cypress/e2e/parsed/`);
  }

  let pathToParsedFiles = specFilePath.includes('.feature')
    ? specFilePath
        .replace('cypress/e2e/', '')
        .replace(specFilePath.split('/').pop(), '')
        .slice(0, -1)
    : specFilePath.replace('cypress/e2e/', '');

  const slicedFiles = findFeatureFilesRecursively(
    `./cypress/e2e/parsed/${pathToParsedFiles}`,
  );
  return slicedFiles;
}

module.exports = { sliceFeatureFilesRecursively };
