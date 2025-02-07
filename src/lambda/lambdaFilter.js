const { determineFilePropertiesBasedOnTags } = require('../utils/handlers');
const { findArrayDifference } = require('../utils/helper');
const { getLogger } = require('../logger/logger');
async function filterFeatureFilesByTag(featureFiles, tag) {
  const logger = getLogger();
  // Determine the final files based on the tags
  const filesToIncludeBasedOnTags = [];
  const filesToExcludeBasedOnTags = [];
  for (let file of featureFiles) {
    const shouldProcess = determineFilePropertiesBasedOnTags(file, tag);

    // Replace the parsed path before sending it to the lambda executor.
    file = file.replace('cypress/e2e/parsed/', '');

    shouldProcess
      ? filesToIncludeBasedOnTags.push(file)
      : filesToExcludeBasedOnTags.push(file);
  }
  // Cut off all the ones which should be excluded
  const finalFiles = findArrayDifference(
    filesToIncludeBasedOnTags,
    filesToExcludeBasedOnTags,
  );

  if (tag) {
    logger.info(
      "Found files to execute matching tag criteria: '" +
        tag +
        "'" +
        '\nFiles found: ' +
        finalFiles,
    ),
      { finalFiles };
  } else {
    logger.info('Found files to execute: ' + finalFiles, { finalFiles });
  }

  return finalFiles;
}

module.exports = {
  filterFeatureFilesByTag,
};
