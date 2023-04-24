#!/usr/bin/env node

const colors = require("colors");
colors.enable();
const {
  getInputData,
  getExecutionType,
  setS3RunPath,
  handleExecutionTypeInput,
} = require("./utils/handlers");

const { executeEcs } = require("./utils/ecsExecutor");
const { executeLocal } = require("./utils/localExecutor");
const { executeLambdas } = require("./utils/lambdaExecutor");
const { line, setRunId, getRunId, setOrgUrl } = require("./utils/helper");

async function main() {
  // Determine execution type
  const { executionTypeInput, reporterBaseUrl, s3BucketName, customPath } =
    await getInputData();
  handleExecutionTypeInput(executionTypeInput);

  // Set and org base url for the links & the runId
  setOrgUrl(reporterBaseUrl);
  setRunId();
  setS3RunPath(s3BucketName, customPath, getRunId());
  line();
  console.log("Your run id is: ", colors.magenta(getRunId()));
  line();

  // Execute
  switch (getExecutionType()) {
    case "lambda":
      await executeLambdas();
      break;
    case "ecs":
      await executeEcs();
      break;
    default:
      await executeLocal();
  }
}

main();
