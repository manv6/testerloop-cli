#!/usr/bin/env node

const colors = require("colors");
colors.enable();
const {
  getInputData,
  getExecutionType,
  handleExecutionTypeInput,
} = require("./utils/handlers");

const { executeEcs } = require("./utils/ecsExecutor");
const { executeLocal } = require("./utils/localExecutor");
const { executeLambdas } = require("./utils/lambdaExecutor");
const { line, setRunId, getRunId, setOrgUrl } = require("./utils/helper");

async function main() {
  // Determine execution type
  const { executionTypeInput } = await getInputData();
  handleExecutionTypeInput(executionTypeInput);

  // Set and log the runId
  setRunId();
  line();
  console.log("Your run id is: ", colors.magenta(getRunId()));
  line();

  // Set the orgUrl. @TODO grab it from an HTTP request
  setOrgUrl("https://otf.overloop.io/");

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
