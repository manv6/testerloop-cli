#!/usr/bin/env node

const colors = require("colors");
colors.enable();
const {
  getExecutionType,

  createAndUploadCICDFileToS3Bucket,
} = require("./utils/handlers");
const { handleExecutionTypeInput } = require("./utils/argumentsHandler");

const { getInputData } = require("./utils/helper");

const { executeEcs } = require("./utils/ecsExecutor");
const { executeLocal } = require("./utils/localExecutor");
const { executeLambdas } = require("./utils/lambdaExecutor");
const {
  line,
  setRunId,
  getRunId,
  setOrgUrl,
  showHelp,
  setRerun,
  setECSRegion,
  setLambdaRegion,
  setS3Region,
  getS3Region,
  getLambdaRegion,
  getECSRegion,
  getOrgUrl,
  setS3RunPath,
} = require("./utils/helper");
const { initializeS3Client } = require("./utils/s3");
const { initializeLambdaClient } = require("./utils/eventProcessor");
const { initializeECSClient, ecsClient } = require("./utils/taskProcessor");

async function main() {
  const {
    executionTypeInput,
    reporterBaseUrl,
    s3BucketName,
    customPath,
    help,
    rerun,
    s3Region,
    ecsRegion,
    lambdaRegion,
  } = await getInputData();
  await setS3Region(s3Region);
  await setECSRegion(ecsRegion);
  await setLambdaRegion(lambdaRegion);
  if (help) {
    showHelp(help);
  } else {
    setRerun(rerun);
    handleExecutionTypeInput(executionTypeInput);
    // Set and org base url for the links & the runId
    setOrgUrl(reporterBaseUrl);
    setRunId();
    setS3RunPath(s3BucketName, customPath, getRunId());
    initializeS3Client(getS3Region());
    createAndUploadCICDFileToS3Bucket(s3BucketName);
    line();
    console.log(
      "Your run id is: ",
      colors.magenta(getRunId()) + "  -> " + `${getOrgUrl()}/run/${getRunId()}`
    );
    line();

    // Execute
    switch (getExecutionType()) {
      case "lambda":
        initializeLambdaClient(getLambdaRegion());
        await executeLambdas();
        break;
      case "ecs":
        initializeECSClient(getECSRegion());
        await executeEcs();
        break;
      default:
        await executeLocal();
    }
  }
}

main();
