const {
  getOrgUrl,
  setExitCode,
  getExitCode,
  clearValues,
  categorizeTags,
  checkIfAllWiped,
  getTestPerState,
  createRunLinks,
  createFailedLinks,
  checkIfContainsTag,
  readConfigurationFIle,
  getRerun,
  getTestStatesPerId,
  getTestResultsFromAllFilesOnlyOnce,
} = require("./helper");
const { sendEventsToLambda } = require("./eventProcessor");
const { syncFilesFromS3, uploadFileToS3 } = require("./s3");
const arg = require("arg");
let s3RunPath;
const LCL = require("last-commit-log");

function getS3RunPath() {
  return s3RunPath;
}
function setS3RunPath(s3BucketName, customPath, runId) {
  s3RunPath = (s3BucketName + "/" + customPath + "/" + runId)
    .replaceAll("//", "/")
    .replaceAll("//", "/");
}

const args = arg({}, { permissive: true });
let executionType;

async function handleResult(bucket) {
  const debug = require("debug")("s3");
  // Grab the files from the s3 and store them locally to get results
  const directory = `./logs/testResults/${getS3RunPath().replace(
    bucket + "/",
    ""
  )}/results`;
  try {
    await syncFilesFromS3(`s3://${getS3RunPath()}/results`, `logs/testResults`);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debug("ERROR fetching results from s3", err);
    setExitCode(1);
  }

  try {
    let failedTestResults;
    let passedTestResults;
    let allResultsOnce = [];

    if (getRerun()) {
      console.log("Retrieving rerun results...");

      // In case of rerun on ECS/local we have the following case
      // Get all tests state from all the files in descending order from creation and make sure it only appears once
      allResultsOnce = await getTestResultsFromAllFilesOnlyOnce(
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

      // In case of no rerun just grab the resulsts from the local files
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
    createRunLinks(getOrgUrl());
    if (failedTestResults.length > 0) {
      await createFailedLinks(failedTestResults, getOrgUrl());
      setExitCode(1);
    } else {
      setExitCode(0);
    }
  } catch (err) {
    console.log(
      "There was an error trying to parse your result files. Please check your s3 and reporter configuration "
    );
    debug("ERROR parsing result files from local folder", err);
  }

  process.exit(getExitCode());
}

async function getFailedLambdaTestResultsFromLocal(bucket) {
  const directory = `./logs/testResults/${getS3RunPath().replace(
    bucket + "/",
    ""
  )}/results`;
  try {
    await syncFilesFromS3(`s3://${getS3RunPath()}/results`, `logs/testResults`);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debug("ERROR fetching results from s3", err);
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
  listOfTestIdsToCheckResults
) {
  const directory = `./logs/testResults/${getS3RunPath().replace(
    bucket + "/",
    ""
  )}/results`;
  try {
    await syncFilesFromS3(`s3://${getS3RunPath()}/results`, `logs/testResults`);
  } catch (err) {
    console.log("Could not retrieve results from s3");
    debug("ERROR fetching results from s3", err);
    setExitCode(1);
  }

  let results = await getTestStatesPerId(
    directory,
    "testResults-",
    listOfTestIdsToCheckResults
  );
  return results;
}

async function getInputData() {
  const cliArgs = await parseArguments();

  // Load JSON data from .testerlooprc file
  let configurationData = await readConfigurationFIle(".testerlooprc.json");

  // Override JSON data with CLI arguments
  let specFiles,
    lambdaTimeOutSecs,
    executionTypeInput,
    executionTimeOutSecs,
    tag,
    customCommand,
    lambdaThreads,
    help,
    rerun;

  for (let i = 0; i < cliArgs.length; i++) {
    switch (cliArgs[i]) {
      case "--test-spec-folder":
        specFiles = cliArgs[i + 1];
        break;
      case "--lambdaTimeoutInSeconds":
        lambdaTimeOutSecs = cliArgs[i + 1];
        break;
      case "--executionTimeOutSecs":
        executionTimeOutSecs = cliArgs[i + 1];
        break;
      case "--execute-on":
        executionTypeInput = cliArgs[i + 1];
        break;
      case "--filter-by-tag":
        tag = cliArgs[i + 1];
        break;
      case "--custom-command":
        customCommand = cliArgs[i + 1];
        break;
      case "--lambda-threads":
        lambdaThreads = cliArgs[i + 1];
        break;
      case "--help":
      case "-h":
        help = true;
        break;
      case "--rerun":
        rerun = true;
        break;
      default:
        break;
    }
  }
  return {
    specFiles: specFiles,
    lambdaArn: configurationData.lambda?.lambdaArn,
    testerLoopKeyId: configurationData.testerLoopKeyId,
    executionTimeOutSecs: configurationData.executionTimeOutSecs || 1200,
    tag: tag,
    lambdaTimeOutSecs:
      lambdaTimeOutSecs || configurationData.lambda?.timeOutInSecs || 120,
    lambdaThreads:
      lambdaThreads || configurationData.lambda?.lambdaThreads || 0,
    executionTypeInput: executionTypeInput,
    containerName: configurationData.ecs?.containerName,
    clusterARN: configurationData.ecs?.clusterARN,
    taskDefinition: configurationData.ecs?.taskDefinition,
    subnets: configurationData.ecs?.subnets,
    securityGroups: configurationData.ecs?.securityGroups,
    uploadToS3RoleArn: configurationData.ecs?.uploadToS3RoleArn,
    envVariablesECS: configurationData.ecs?.envVariables || [],
    envVariablesLambda: configurationData.lambda?.envVariables || [],
    envVariablesECSWithValues:
      configurationData.ecs?.envVariablesWithValues || {},
    envVariablesLambdaWithValues:
      configurationData.lambda?.envVariablesWithValues || {},
    uploadFilesToS3: configurationData.reporter?.uploadFilesToS3 || true,
    s3BucketName:
      configurationData.reporter?.s3BucketName ||
      "testerloop-default-bucket-name",
    customPath: configurationData.reporter?.customPath || "",
    reporterBaseUrl: configurationData?.reporterBaseUrl,
    customCommand: customCommand || "",
    help: help,
    ecsPublicIp: configurationData?.ecs.publicIp || "DISABLED",
    rerun: rerun || false,
    s3Region: configurationData.reporter?.region,
    ecsRegion: configurationData.ecs?.region,
    lambdaRegion: configurationData.lambda?.region,
  };
}

async function handleExecutionTypeInput(input) {
  switch (input) {
    case "lambda":
      setExecutionType("lambda");
      break;
    case "ecs":
      setExecutionType("ecs");
      break;
    case "local-parallel":
      setExecutionType("local-parallel");
      break;
    default:
      setExecutionType("local");
  }
}

function setExecutionType(input) {
  console.log(`LOG: Execution type has been set as: '${input}'`);
  executionType = input;
}

function getExecutionType() {
  return executionType;
}

const parseArguments = async () => {
  const cliArgs = args._;
  return cliArgs;
};

function determineFilePropertiesBasedOnTags(file, tag) {
  const debug = require("debug")("TAGS");
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
    debug(
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

async function clearTheArgs(argsToRemoveArray) {
  return await parseArguments().then((cliArgs) => {
    for (const argToRemove of argsToRemoveArray) {
      const argIndex = cliArgs.indexOf(argToRemove.argName);

      if (argIndex !== -1 && argIndex < cliArgs.length - 1) {
        if (argToRemove.hasValue) {
          cliArgs.splice(argIndex, 2);
        } else {
          cliArgs.splice(argIndex, 1);
        }
      }
    }
    return cliArgs;
  });
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

async function createAndUploadCICDFileToS3Bucket(s3BucketName) {
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

  uploadFileToS3(
    s3BucketName,
    `${getS3RunPath().replace(s3BucketName + "/", "")}/logs/cicd.json`,
    JSON.stringify({ ...commit, ...env })
  );
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
  const debug = require("debug")("THROTTLING");
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
    debug("List of files to be sent on this iteration: ", listOfFilesToSend);

    tempResults = await sendEventsToLambda(
      listOfFilesToSend,
      lambdaArn,
      envVariables
    );

    tempResults.forEach((result, index) => {
      console.log(
        `-> Triggered Test id: ${result.$metadata.requestId} -> ${listOfFilesToSend[index]}`
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
  getInputData,
  getS3RunPath,
  setS3RunPath,
  getExecutionType,
  handleExecutionTimeout,
  removeTestFromList,
  checkLambdaHasTimedOut,
  createFinalCommand,
  handleExecutionTypeInput,
  getEnvVariableValuesFromCi,
  createAndUploadCICDFileToS3Bucket,
  getLambdaTestResultsFromLocalBasedOnId,
  determineFilePropertiesBasedOnTags,
  sendTestsToLambdasBasedOnAvailableSlots,
  getFailedLambdaTestResultsFromLocal,
  getEnvVariableWithValues,
};
