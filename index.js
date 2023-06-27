#!/usr/bin/env node

const colors = require("colors");
colors.enable();
const {
  getExecutionType,

  createAndUploadCICDFileToS3Bucket,
} = require("./src/utils/handlers");
const { handleExecutionTypeInput } = require("./src/utils/argumentsHandler");

const { getInputData } = require("./src/utils/helper");

const { executeEcs } = require("./src/utils/ecsExecutor");
const { executeLocal } = require("./src/utils/localExecutor");
const { executeLambdas } = require("./src/utils/lambdaExecutor");
const { line, getNewRunId, getS3RunPath, showHelp } = require("./src/utils/helper");
const { initializeS3Client } = require("./src/utils/s3");
const { initializeLambdaClient } = require("./src/utils/eventProcessor");
const { initializeECSClient } = require("./src/utils/taskProcessor");

async function main() {
  const {
    executionTypeInput,
    reporterBaseUrl,
    s3BucketName,
    customPath,
    help,
    s3Region,
    ecsRegion,
    lambdaRegion,
  } = await getInputData();
  if (help) {
    showHelp(help);
  } else {
    handleExecutionTypeInput(executionTypeInput);
    // Set and org base url for the links & the runId
    const runId = getNewRunId();
    const s3RunPath = getS3RunPath(s3BucketName, customPath, runId);
    initializeS3Client(s3Region);
    createAndUploadCICDFileToS3Bucket(s3BucketName, s3RunPath);
    line();
    console.log(
      "Your run id is: ",
      colors.magenta(runId) + "  -> " + `${reporterBaseUrl}/run/${runId}`
    );
    line();

    // Execute
    switch (getExecutionType()) {
      case "lambda":
        initializeLambdaClient(lambdaRegion);
        await executeLambdas(runId, s3RunPath);
        break;
      case "ecs":
        initializeECSClient(ecsRegion);
        await executeEcs(runId, s3RunPath);
        break;
      default:
        await executeLocal(runId, s3RunPath);
    }
  }
}

main();
