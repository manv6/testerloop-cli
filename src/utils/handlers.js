const LCL = require("last-commit-log");
const {
  setExitCode,
  getExitCode,
  clearValues,
  categorizeTags,
  checkIfAllWiped,
  getTestPerState,
  createRunLinks,
  createFailedLinks,
  checkIfContainsTag,
  getInputData,
  getTestStatesPerId,
  getTestResultsFromAllFilesOnlyOnceByTestName,
} = require("./helper");

const colors = require("colors");
const { clearTheArgs } = require("./argumentsParser");
const { sendEventsToLambda } = require("../lambda/eventProcessor");
const { syncS3TestResultsToLocal, uploadJSONToS3 } = require("../s3");
const { debugS3, debugThrottling, debugTags } = require("../debug");

async function handleResult(bucket, s3RunPath, runId) {
  // Grab the files from the s3 and store them locally to get results
  const directory = `./logs/testResults/${s3RunPath.replace(
    bucket + "/",
    ""
  )}/results`;

  try {
    await syncS3TestResultsToLocal(s3RunPath);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debugS3("ERROR fetching results from s3", err);
    setExitCode(1);
  }

  try {
    let failedTestResults;
    let passedTestResults;
    let allResultsOnce = [];
    const { reporterBaseUrl, rerun } = await getInputData();

    if (rerun) {
      console.log("Retrieving rerun results...");

      // In case of rerun on ECS/local we have the following case
      // Get all tests state from all the files in descending order from creation and make sure it only appears once
      allResultsOnce = await getTestResultsFromAllFilesOnlyOnceByTestName(
        directory,
        "testResults-"
      );
      failedTestResults = allResultsOnce.filter(
        (testResult) => testResult.status === "failed"
      );
      passedTestResults = allResultsOnce.filter(
        (testResult) => testResult.status === "passed"
      );
    } else {
      console.log("Retrieving results...");

      // In case of no rerun just grab the results from the local files
      failedTestResults = await getTestPerState(
        directory,
        "testResults-",
        "failed"
      );

      passedTestResults = await getTestPerState(
        directory,
        "testResults-",
        "passed"
      );
    }

    await createRunLinks(reporterBaseUrl, runId);

    if (failedTestResults.length > 0) {
      await createFailedLinks(runId, failedTestResults, reporterBaseUrl);
      setExitCode(1);
    } else {
      setExitCode(0);
    }
  } catch (err) {
    console.log(
      "There was an error trying to parse your result files. Please check your s3 and reporter configuration "
    );
    console.log("Error", err);
    log("ERROR parsing result files from local folder", err);
  }

  process.exit(getExitCode());
}

async function getFailedLambdaTestResultsFromLocal(bucket, s3RunPath) {
  const directory = `./logs/testResults/${s3RunPath.replace(
    bucket + "/",
    ""
  )}/results`;
  try {
    await syncS3TestResultsToLocal(s3RunPath);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debugS3("ERROR fetching results from s3", err);
    setExitCode(1);
  }

  let failedTestResults = await getTestPerState(
    directory,
    "testResults-",
    "failed"
  );

  const filePaths = [];
  for (const test of failedTestResults) {
    filePaths.push(test.pathToTest.replace("cypress/e2e/parsed/", ""));
  }

  return filePaths;
}

async function getLambdaTestResultsFromLocalBasedOnId(
  bucket,
  listOfTestIdsToCheckResults,
  s3RunPath
) {
  const directory = `./logs/testResults/${s3RunPath.replace(
    bucket + "/",
    ""
  )}/results`;
  try {
    await syncS3TestResultsToLocal(s3RunPath);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debugThrottling("ERROR fetching results from s3", err);
    setExitCode(1);
  }

  let results = await getTestStatesPerId(
    directory,
    "testResults-",
    listOfTestIdsToCheckResults
  );
  return results;
}


function determineFilePropertiesBasedOnTags(file, tag) {
  // If tag exists then determine based on the tags
  // Return the properties fileHasTag , unWipedScenarios, tagsIncludedExclude
  let unWipedScenarios;
  let fileHasTag;
  let tagsIncludedExcluded;
  if (tag) {
    tagsIncludedExcluded = categorizeTags(tag);

    tagsIncludedExcluded.includedTags.forEach((tag) => {
      if (!fileHasTag) {
        fileHasTag = tag !== undefined ? checkIfContainsTag(file, tag) : false;
      }
    });
    debugTags(
      "Included and excluded tags per file",
      tagsIncludedExcluded,
      " -> ",
      file
    );
    let result = [];
    tagsIncludedExcluded.excludedTags.forEach((tag) => {
      result.push(checkIfAllWiped(file, tag));
    });
    unWipedScenarios = result.includes(false) ? false : true;

    return { fileHasTag, unWipedScenarios, tagsIncludedExcluded };
  } else {
    unWipedScenarios = true;
    return { unWipedScenarios };
  }
}

async function createFinalCommand() {
  let argsToRemove = [
    { argName: "--execute-on", hasValue: true },
    { argName: "--rerun", hasValue: false },
  ];

  let clearedArgs = await clearTheArgs(argsToRemove);
  const finalCommand = "npx " + clearedArgs.join(" ");
  return finalCommand;
}

async function createAndUploadCICDFileToS3Bucket(s3BucketName, s3RunPath) {
  try {
    const lcl = new LCL();
    const commit = lcl.getLastCommitSync();

    let env = clearValues({ ...process.env }, [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ]);

    let additionalEnvsForLocalExecution = {
      GITHUB_SERVER_URL: "local",
      GITHUB_REF_NAME: "local",
      GITHUB_REPOSITORY: "local",
      GITHUB_REPOSITORY_OWNER: "local",
    };

    env = Object.keys(additionalEnvsForLocalExecution).reduce((acc, key) => {
      if (!env.hasOwnProperty(key)) {
        acc[key] = additionalEnvsForLocalExecution[key];
      }
      return acc;
    }, env); // Check if each variable in additionalEnvsForLocalExecution is already in env

    await uploadJSONToS3(s3BucketName, s3RunPath, { ...commit, ...env });
  } catch (err) {
    console.log("ERROR: Not able to upload the cicd.json file to s3.");
    console.log(
      "This can result in a breaking bebug page. Make sure your git repository is properly setup"
    );
    console.log("Error: ", err);
  }
}

function getEnvVariableValuesFromCi(listOfVariables) {
  const listOfVariablesWithValues = [];
  for (const variable of listOfVariables) {
    listOfVariablesWithValues.push({
      name: variable,
      value: process.env[variable],
    });
  }
  return listOfVariablesWithValues;
}

function getEnvVariableWithValues(jsonVariables) {
  // Check if jsonVariables is an array
  colors.enable();
  if (Array.isArray(jsonVariables)) {
    console.log(
      colors.red(
        "ERROR - 'envVariablesWithValues' in your testerlooprc.json is an array when it should be an object. \nThis can cause your tests to not work properly"
      )
    );
    return [];
  }

  const listOfVariablesWithValues = [];
  // Iterate over the object and extract the values
  for (var key in jsonVariables) {
    if (jsonVariables.hasOwnProperty(key)) {
      listOfVariablesWithValues.push({
        name: key,
        value: jsonVariables[key],
      });
    }
  }
  return listOfVariablesWithValues;
}

async function handleExecutionTimeout(timeCounter) {
  const colors = require("colors");
  colors.enable();
  const { executionTimeOutSecs } = await getInputData();
  if (timeCounter >= executionTimeOutSecs) {
    setExitCode(1);
    console.log(
      colors.red(
        "Execution timed out after " +
        executionTimeOutSecs +
        " seconds. Results may vary"
      )
    );
    return true;
  } else return false;
}

async function checkLambdaHasTimedOut(test, lambdaTimeOutSecs) {
  const timeNow = Date.now();
  if (timeNow - test.startDate < lambdaTimeOutSecs * 1000) {
    return false;
  } else {
    console.log(
      `- Lambda '${test.tlTestId}' has timed out after ${lambdaTimeOutSecs} seconds`
    );
    return true;
  }
}

function removeTestFromList(listOfTests, test) {
  // find the index of the object you want to remove
  let index = listOfTests.findIndex((obj) => obj.tlTestId === test.tlTestId);

  // remove the object from the array using splice()
  if (index !== -1) {
    listOfTests.splice(index, 1);
  }
}

/* 
  // Returns a list of all the files sent to the lambdas
  */
async function sendTestsToLambdasBasedOnAvailableSlots(
  allFilesToBeSent,
  availableSlots,
  testsSentSoFar,
  lambdaThreads,
  lambdaArn,
  envVariables
) {
  let listOfFilesToSend = [];
  let tempResults = [];
  let numberOfTestFilesSent = testsSentSoFar;
  let requestIdsToCheck = [];

  // Safeguard. Hard cap the number of available tests you can execute
  if (availableSlots > lambdaThreads) {
    availableSlots = lambdaThreads;
  }

  // If there are slots, send the events and store the results in a listToCheck array
  if (availableSlots > 0 && testsSentSoFar < allFilesToBeSent.length) {
    for (let i = 0; i < availableSlots; i++) {
      if (numberOfTestFilesSent < allFilesToBeSent.length) {
        // Start adding files where we left off from prev iteration
        listOfFilesToSend.push(allFilesToBeSent[testsSentSoFar + i]);
        numberOfTestFilesSent++;
      }
    }
    debugThrottling("List of files to be sent on this iteration: ", listOfFilesToSend);

    tempResults = await sendEventsToLambda(
      listOfFilesToSend,
      lambdaArn,
      envVariables
    );

    tempResults.forEach((result, index) => {
      console.log(
        `--> Triggered Test id: ${result.$metadata.requestId} -> ${listOfFilesToSend[index]}`
      );

      let test = {
        tlTestId: JSON.stringify(result.$metadata.requestId).replaceAll(
          '"',
          ""
        ),
        fileName: listOfFilesToSend[index],
        result: "running",
        startDate: Date.now(),
      };
      requestIdsToCheck.push(test);
    });
  }
  return requestIdsToCheck;
}

module.exports = {
  handleResult,
  handleExecutionTimeout,
  removeTestFromList,
  checkLambdaHasTimedOut,
  createFinalCommand,
  getEnvVariableValuesFromCi,
  createAndUploadCICDFileToS3Bucket,
  getLambdaTestResultsFromLocalBasedOnId,
  determineFilePropertiesBasedOnTags,
  sendTestsToLambdasBasedOnAvailableSlots,
  getFailedLambdaTestResultsFromLocal,
  getEnvVariableWithValues,
};
