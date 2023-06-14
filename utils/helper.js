const { v4 } = require("uuid");
const { readFileSync, readFile } = require("fs");

let runId, orgURL, exitCode, rerun, s3Region, ecsRegion, lambdaRegion;

function wait(ms = 5000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function findArrayDifference(array1, array2) {
  return array1.filter((value) => !array2.includes(value));
}

function findArrayUnion(array1, array2) {
  const combinedArray = array1.concat(array2);
  return Array.from(new Set(combinedArray));
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
async function setS3Region(region) {
  s3Region = region;
}

function getS3Region() {
  return s3Region;
}

function getECSRegion() {
  return ecsRegion;
}

async function setECSRegion(region) {
  ecsRegion = region;
}

function getLambdaRegion() {
  return lambdaRegion;
}

async function setLambdaRegion(region) {
  lambdaRegion = region;
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
    "----------------------------------------------------------------------------------------------------------------------------"
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

async function getLatestFile(directory, filePrefix) {
  try {
    const files = await fse.readdir(directory);
    const results = files.filter((file) => file.startsWith(filePrefix));

    // Extract and convert timestamps, then sort in ascending order
    var sortedTimestamps = results
      .map(function (result) {
        var timestamp = result.replace("testResults-", "").replace(".json", "");
        return parseInt(timestamp, 10);
      })
      .sort(function (a, b) {
        return b - a;
      });
    // Create a new array with sorted string items
    var sortedItems = sortedTimestamps.map(function (timestamp) {
      return "testResults-" + timestamp + ".json";
    });
    // Output the sorted items
    return sortedItems[0];
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getTestStatesPerId(directory, filePrefix, listOfTestsToCheck) {
  let responseArray = [];

  try {
    const files = await fse.readdir(directory);

    for (const file of files) {
      if (file.startsWith(filePrefix)) {
        const json = await fse.readJSON(path.join(directory, file));
        for (const testIdToCheck of listOfTestsToCheck) {
          const filteredData = json.filter(
            (item) => item.testId === testIdToCheck
          );
          for (const contents of filteredData) {
            responseArray.push(contents);
          }
        }
      }
    }
    return responseArray;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getTestPerState(directory, filePrefix, testState) {
  let responseArray = [];

  try {
    const files = await fse.readdir(directory);

    for (const file of files) {
      if (file.startsWith(filePrefix)) {
        const json = await fse.readJSON(path.join(directory, file));
        const filteredData = json.filter((item) => item.status === testState);
        for (const contents of filteredData) {
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

async function getTestPerStateFromFile(directory, fileName, testState) {
  let responseArray = [];

  try {
    const json = await fse.readJSON(path.join(directory, fileName));
    const filteredData = json.filter((item) => item.status === testState);
    for (const contents of filteredData) {
      responseArray.push(contents);
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
  for (const failed of failedTests) {
    const failedUrl = `${orgURL}/run/${getRunId()}/test/${failed.testId}`;
    console.log(`Test failed: ${failed.title} `, failedUrl);
  }
  line();
}

async function createRunLinks(orgURL) {
  line();
  console.log(`Testerloop run URL: ${orgURL}/run/${getRunId()}`);
  line();
}

function extractTags(inputString) {
  const regex = /@(\w+)/g;
  const matches = inputString.match(regex);
  const tags = [];

  if (matches) {
    for (let i = 0; i < matches.length; i++) {
      tags.push(matches[i]);
    }
  }

  return tags;
}

function getNonCommonElements(array1, array2) {
  const set1 = new Set(array1);
  const set2 = new Set(array2);

  const nonCommonElements = [
    ...array1.filter((item) => !set2.has(item)),
    ...array2.filter((item) => !set1.has(item)),
  ];

  return nonCommonElements;
}

function categorizeTags(inputString) {
  let includedTags = [];
  let excludedTags = [];
  const allTags = extractTags(inputString);
  const regex = /not\s+((\(@\w+(\s+and\s+@\w+)*\))|@\w+)/g;

  let match = regex.exec(inputString);
  if (match !== null) {
    excludedTags = extractTags(match[0]);
    includedTags = getNonCommonElements(excludedTags, allTags);
  } else if (allTags.length > 0) {
    includedTags = allTags;
  }
  return { includedTags, excludedTags };
}

function checkIfContainsTag(filename, str) {
  const contents = readFileSync(filename, "utf-8");
  const re = RegExp(`(^|\\s)${str}(\\s|$)`);
  return contents.match(re);
}

function checkIfAllWiped(filename, tag) {
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

function showHelp() {
  const colors = require("colors");

  console.log(
    colors.grey("[rerun]") +
      ' Usage  : npx tl --rerun cucumber-cypress-rerun --feature-files cypress/e2e --env TAGS=\\"@overloop\\" --browser chrome'
  );
  console.log(
    "\t \t  --rerun: defines if there is a rerun mechanism for cypress"
  );
  console.log("\n");

  console.log(
    colors.blue("[local]") + " Usage  : npx tl cypress run ...cypress_options "
  );
  console.log(
    colors.blue("[local]") +
      " Example: npx tl cypress run --spec e2e/login.feature --browser chrome --headless"
  );
  console.log(colors.blue("[local]") + " Params : Any cypress parameters");
  console.log("\n");

  console.log(
    colors.magenta("[lambda]") +
      " Usage  : npx tl --execute-on ecs ...ecs_options "
  );
  console.log(
    colors.magenta("[lambda]") +
      " Example: npx tl --execute-on lambda --spec e2e/login.feature --tag @mytag"
  );
  console.log(
    colors.magenta("[lambda]") +
      " Params : Lambda execution accepts the following:"
  );
  console.log("\t \t  --execute-on: defines where to execute the tests");
  console.log(
    "\t \t  --spec:       select a folder of tests or a specific test"
  );

  console.log(
    "\t \t  --lambdaTimeoutInSeconds: The amount of time in seconds to wait for the lambdas to complete"
  );
  console.log("\n");

  console.log(
    colors.yellow("[ecs]") + " Usage  : npx tl --execute-on ecs ...ecs_options "
  );
  console.log(
    colors.yellow("[ecs]") +
      " Example: npx tl --execute-on ecs --spec e2e/login.feature --tag @mytag"
  );
  console.log(
    colors.yellow("[ecs]") + " Params : Ecs execution accepts the following:"
  );
  console.log("\t \t  --execute-on: defines where to execute the tests");
  console.log(
    "\t \t  --test-spec-folder:       select a folder of tests or a specific test"
  );
  console.log(
    "\t \t  --filter-by-tag:        filter the feature files based on specific tags"
  );
  console.log(
    "\t \t  --custom-command: Send a custom command to an ecs task. example ( --custom-command 'npx cucumber-cypress-rerun --spec %TEST_FILE --browser chrome' ) "
  );
  console.log(
    "\t \t \t  %TEST_FILE: Each test file found from the spec is exposed as %TEST_FILE with full path to the file"
  );
  console.log(
    "\t \t \t  %TEST_FILENAME: Each test file found from the spec is exposed as %TEST_FILE with full path to the file"
  );
}

function setRerun(rerunInput) {
  rerun = rerunInput;
}

function getRerun() {
  return rerun;
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
  checkIfAllWiped,
  readConfigurationFIle,
  wait,
  line,
  showHelp,
  clearValues,
  findArrayUnion,
  getTestPerState,
  getTestStatesPerId,
  createRunLinks,
  categorizeTags,
  clearFeaturePath,
  createFailedLinks,
  findArrayDifference,
  arraysHaveSameElements,
  setRerun,
  getRerun,
  getLatestFile,
  getTestPerStateFromFile,
  getECSRegion,
  getS3Region,
  getLambdaRegion,
  setECSRegion,
  setS3Region,
  setLambdaRegion,
};
