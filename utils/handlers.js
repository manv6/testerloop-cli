const {
  getOrgUrl,
  setExitCode,
  getExitCode,
  getFailedTests,
  createFailedLinks,
  readConfigurationFIle,
} = require("./helper");
const { syncFilesFromS3 } = require("./s3");
const arg = require("arg");
let s3RunPath;

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
    // Grab the failed files from the s3 and store them locally
    await syncFilesFromS3(
      `s3://${getS3RunPath()}/results`,
      `logs/failedTestResults`
    );

    // Iterate through the failed test files and determine the failed ids to create the links
    const directory = `./logs/failedTestResults/${getS3RunPath().replace(
      bucket + "/",
      ""
    )}/results`;
    const failedTestResults = await getFailedTests(directory, "failed-");
    await createFailedLinks(failedTestResults, getOrgUrl());
    failedTestResults.length > 0 ? setExitCode(1) : setExitCode(0);
  }
  process.exit(getExitCode());
}

async function getInputData() {
  const cliArgs = await parseArguments();

  // Load JSON data from .testerlooprc file
  let configurationData = await readConfigurationFIle(".testerlooprc.json");

  // Override JSON data with CLI arguments
  let specFiles,
    timeOutInSecs = 120,
    executionTypeInput,
    tag;

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
    envVariables: configurationData.envVariables || [],
    uploadFilesToS3: configurationData.reporter?.uploadFilesToS3 || true,
    s3BucketName:
      configurationData.reporter?.s3BucketName ||
      "testerloop-default-bucket-name",
    customPath: configurationData.reporter?.customPath || "",
    reporterBaseUrl: configurationData?.reporterBaseUrl,
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
  //force the arguments to be cypress run if they are not specified
  const cliArgs = args._;
  if (cliArgs[0] !== "cypress") cliArgs.unshift("cypress");
  if (cliArgs[1] !== "run") cliArgs.splice(1, 0, "run");
  return cliArgs;
};

async function clearTheArgs(argsToRemoveArray) {
  return await parseArguments().then((cliArgs) => {
    for (const argToRemove of argsToRemoveArray) {
      const argIndex = cliArgs.indexOf(argToRemove);

      if (argIndex !== -1 && argIndex < cliArgs.length - 1) {
        cliArgs.splice(argIndex, 2);
      }
    }
    return cliArgs;
  });
}

async function createFinalCommand() {
  let argsToRemove = ["--execute-on"];

  let clearedArgs = await clearTheArgs(argsToRemove);
  const finalCommand = "npx " + clearedArgs.join(" ");
  return finalCommand;
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
};
