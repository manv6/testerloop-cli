const { v4 } = require("uuid");
const { readFileSync, readFile } = require("fs");

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
  orgURL = orgUrl.endsWith("/") ? orgUrl.slice(0, -1) : orgUrl;
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
  line();
  for (const failed of failedTests) {
    console.log(
      colors.red(`Test failed: `) +
        `${failed.title} ` +
        colors.magenta(`${orgURL}/run/${getRunId()}/test/${failed.testId}`)
    );
  }
  line();
}

function checkIfContainsTag(filename, str) {
  const contents = readFileSync(filename, "utf-8");
  const re = RegExp(`(^|\\s)${str}(\\s|$)`);
  return contents.match(re);
}

function checkIfAllWipped(filename, tag) {
  // Check if every scenario is wipped
  const contents = readFileSync(filename, "utf-8");
  let numOfScenarios = (contents.match(/Scenario:/g) || []).length;
  numOfScenarios += (contents.match(/Scenario Outline:/g) || []).length;
  const tagRegex = new RegExp(`${tag}`, "g");
  const numOfTagged = (contents.match(tagRegex) || []).length;
  return numOfTagged < numOfScenarios;
}

async function readConfigurationFIle(file) {
  return new Promise(function (resolve, reject) {
    readFile(file, "utf-8", (err, data) => {
      if (err) {
        console.error(`Error reading ${file} file 1: ${err}`);
        return;
      }
      resolve(JSON.parse(data));
    });
  });
}

function cleanInput(str) {
  return str.split(",").map((str) => str.trim());
}

module.exports = {
  setRunId,
  getRunId,
  getOrgUrl,
  setOrgUrl,
  cleanInput,
  getExitCode,
  setExitCode,
  checkIfContainsTag,
  checkIfAllWipped,
  readConfigurationFIle,
  wait,
  line,
  clearValues,
  getFailedTests,
  clearFeaturePath,
  createFailedLinks,
  arraysHaveSameElements,
};
