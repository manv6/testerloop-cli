const { v4 } = require("uuid");
let runId, orgURL, exitCode;

function wait(ms = 5000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function arraysHaveSameElements(id, res) {
  return new Promise((resolve, reject) => {
    if (id.every((id) => res.includes(`${id.requestId}/`))) {
      resolve(true);
    } else {
      reject(false);
    }
  });
}

function getRunId() {
  return runId;
}

function getOrgUrl() {
  return orgURL;
}

function getExitCode() {
  return exitCode;
}

function setExitCode(code) {
  return (exitCode = code);
}

function setRunId() {
  runId = v4();
  return runId;
}

function setOrgUrl(orgUrl) {
  orgURL = orgUrl;
}

function line() {
  console.log(
    "----------------------------------------------------------------------------------------------------------"
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
      colors.red(`Test failed: `) +
        `${failed.title} ` +
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
  getOrgUrl,
  setOrgUrl,
  getExitCode,
  setExitCode,
  wait,
  line,
  clearValues,
  getFailedTests,
  clearFeaturePath,
  createFailedLinks,
  arraysHaveSameElements,
};
