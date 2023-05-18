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
  getLatestFile,
  getTestPerStateFromFile,
} = require("./helper");
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

async function handleResult(bucket, customPath) {
  // If the exit code is already known, ignore (timeout case)
  if (!getExitCode()) {
    // Grab the files from the s3 and store them locally to get results
    try {
      await syncFilesFromS3(
        `s3://${getS3RunPath()}/results`,
        `logs/testResults`
      );
      const directory = `./logs/testResults/${getS3RunPath().replace(
        bucket + "/",
        ""
      )}/results`;

      let failedTestResults;
      let passedTestResults;

      if (getRerun()) {
        console.log("Retrieving rerun results...");

        const testResultFileName = await getLatestFile(
          directory,
          "testResults-"
        );
        failedTestResults = await getTestPerStateFromFile(
          directory,
          testResultFileName,
          "failed"
        );
        passedTestResults = await getTestPerStateFromFile(
          directory,
          testResultFileName,
          "passed"
        );
      } else {
        console.log("Retrieving results...");

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

      if (failedTestResults.length > 0) {
        await createFailedLinks(failedTestResults, getOrgUrl());
        setExitCode(1);
      } else {
        createRunLinks(getOrgUrl());
        setExitCode(0);
      }
    } catch (err) {
      console.log("Could not retrieve results from s3");
      setExitCode(1);
    }
  }

  process.exit(getExitCode());
}

async function getInputData() {
  const cliArgs = await parseArguments();

  // Load JSON data from .testerlooprc file
  let configurationData = await readConfigurationFIle(".testerlooprc.json");

  // Override JSON data with CLI arguments
  let specFiles,
    timeOutInSecs,
    executionTypeInput,
    tag,
    customCommand,
    help,
    rerun;

  for (let i = 0; i < cliArgs.length; i++) {
    switch (cliArgs[i]) {
      case "--spec":
        specFiles = cliArgs[i + 1];
        break;
      case "--lambdaTimeoutInSeconds":
        timeOutInSecs = cliArgs[i + 1];
        break;
      case "--execute-on":
        executionTypeInput = cliArgs[i + 1];
        break;
      case "--tag":
        tag = cliArgs[i + 1];
        break;
      case "--custom-command":
        customCommand = cliArgs[i + 1];
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
    tag: tag,
    timeOutInSecs:
      timeOutInSecs || configurationData.lambda?.timeOutInSecs || 120,
    executionTypeInput: executionTypeInput,
    containerName: configurationData.ecs?.containerName,
    clusterARN: configurationData.ecs?.clusterARN,
    taskDefinition: configurationData.ecs?.taskDefinition,
    subnets: configurationData.ecs?.subnets,
    securityGroups: configurationData.ecs?.securityGroups,
    uploadToS3RoleArn: configurationData.ecs?.uploadToS3RoleArn,
    envVariablesECS: configurationData.ecs?.envVariables || [],
    envVariablesLambda: configurationData.lambda?.envVariables || [],
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

module.exports = {
  handleResult,
  getInputData,
  getS3RunPath,
  setS3RunPath,
  getExecutionType,
  createFinalCommand,
  handleExecutionTypeInput,
  getEnvVariableValuesFromCi,
  createAndUploadCICDFileToS3Bucket,
  determineFilePropertiesBasedOnTags,
};
