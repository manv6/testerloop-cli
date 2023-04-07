const { v4 } = require("uuid");
let runId;

function wait(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRunId() {
  return runId;
}

function setRunId() {
  runId = v4();
  return runId;
}

function line() {
  console.log(
    "------------------------------------------------------------------------------------------------------------------------------"
  );
}

function clearValues(object, keysArray = []) {
  keysArray.forEach((element) => {
    delete object[element];
  });
  return object;
}

function clearFeaturePath(featureFile) {
  return featureFile.split("/").pop();
}
const fse = require("fs-extra");
const path = require("path");
const { syncFilesFromS3 } = require("./s3");

async function getFailedTests(directory, prefix) {
  let responseArray = [];

  try {
    const files = await fse.readdir(directory);

    for (const file of files) {
      if (file.startsWith(prefix)) {
        const json = await fse.readJSON(path.join(directory, file));
        for (const contents of json) {
          responseArray.push(contents);
        }
      }
    }
    return responseArray;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function createFailedLinks(failedTests, orgURL) {
  const colors = require("colors");
  colors.enable();
  console.log(
    "-----------------------------------------------------------------------------------------------------"
  );
  for (const failed of failedTests) {
    console.log(
      `Test faied: ${failed.title} ` +
        colors.magenta(`${orgURL}runs/${getRunId()}/testId/${failed.testId}`)
    );
  }
  console.log(
    "-------------------------------------------------------------------------------------------"
  );
}

module.exports = {
  setRunId,
  getRunId,
  wait,
  line,
  clearValues,
  getFailedTests,
  clearFeaturePath,
  createFailedLinks,
};
