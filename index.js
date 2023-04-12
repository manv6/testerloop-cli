#!/usr/bin/env node

const arg = require("arg");
const glob = require("glob");
const colors = require("colors");

const { spawn, exec } = require("child_process");
const { cucumberSlicer } = require("cucumber-cypress-slicer");
const { sendEventsToLambda } = require("./utils/eventProcessor");
/* eslint-disable max-len */
/* eslint-disable no-console */

const {
  wait,
  line,
  setRunId,
  getRunId,
  getOrgUrl,
  setOrgUrl,
  getExitCode,
  setExitCode,
  getFailedTests,
  clearFeaturePath,
  createFailedLinks,
  arraysHaveSameElements,
} = require("./utils/helper");
const { syncFilesFromS3, listS3Folders } = require("./utils/s3");
colors.enable();

let executionType;
const args = arg({}, { permissive: true });

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
        const argValue = cliArgs[argIndex + 1];
        cliArgs.splice(argIndex, 2);
      }
    }
    return cliArgs;
  });
}

// Handle all the testerloop related arguments
async function getInputData() {
  const cliArgs = await parseArguments();
  let specFiles,
    lambdaArn,
    testerLoopKeyId,
    timeOutInSecs = 120,
    executionTypeInput;
  for (let i = 0; i < cliArgs.length; i++) {
    switch (cliArgs[i]) {
      case "--keyId":
        testerLoopKeyId = cliArgs[i + 1];
        break;
      case "--spec":
        specFiles = cliArgs[i + 1];
        break;
      case "--lambda-arn":
        lambdaArn = cliArgs[i + 1];
        break;
      case "--pollTimeoutInSeconds":
        timeOutInSecs = cliArgs[i + 1];
        break;
      case "--execute-on":
        executionTypeInput = cliArgs[i + 1];
        break;
      default:
        break;
    }
  }
  return {
    specFiles,
    lambdaArn,
    testerLoopKeyId,
    timeOutInSecs,
    executionTypeInput,
  };
}

async function handleExecutionType(input) {
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

async function createFinalCommand() {
  let argsToRemove = ["--keyId", "--execute-on"];
  let envVariablesToPassOnCommand = [`RUN_ID=${getRunId()}`];

  let clearedArgs = await clearTheArgs(argsToRemove);
  const finalCommand =
    envVariablesToPassOnCommand.join(" ") + " npx " + clearedArgs.join(" ");
  return finalCommand;
}

async function executeLocal() {
  const command = await createFinalCommand();
  console.log("LOG: Executing command: ", command);
  // This exec will be removed when the
  // reporter plugin creates a runId path for the logs
  exec("rm -rf ./logs", { shell: true, stdio: "inherit" });

  const child = spawn(command, { shell: true, stdio: "inherit" });
  if (child.stdout) {
    child.stdout.pipe(process.stdout);
  }

  if (child.stderr) {
    child.stderr.pipe(process.stderr);
  }

  child.on("close", async () => {
    await handleResult();
  });
}

async function executeLambdas() {
  const { specFiles, lambdaArn, timeOutInSecs } = await getInputData();

  // Slice the cucumber files
  let filesToExecute = specFiles.includes(".feature")
    ? specFiles
    : specFiles + "/*.feature";
  await cucumberSlicer(filesToExecute, `./cypress/e2e/parsed/`);
  const files = glob
    .sync(`./cypress/e2e/parsed/cypress/e2e/*.feature`)
    .map((file) => `${file}`);
  console.log("LOG: Found files to execute: ", files);

  // Send the events to the lambda
  const results = await sendEventsToLambda(files, getRunId(), lambdaArn);

  // Push the results into an array to handle later for polling
  let requestIdsToCheck = [];
  line();
  results.forEach((result, index) => {
    console.log(
      "Request id:    ",
      result.$metadata.requestId,
      `   ${clearFeaturePath(files[index])}`
    );

    requestIdsToCheck.push({
      requestId: JSON.stringify(result.$metadata.requestId).replaceAll('"', ""),
      fileName: files[index],
      result: "running",
      startDate: Date.now(),
    });
  });
  line();

  // Poll for results in s3
  let finished = false;
  let counter = 0;
  let timedOut = false;

  while (finished !== true && timedOut !== true) {
    try {
      // Poll s3 for results in s3/bucket/customPath/runId/
      let customPath = `custom/results/${getRunId()}/`;
      let results = await listS3Folders("otf-lambda-results", customPath);
      console.log("Polling results = ", results);
      // Check if the results include all the request IDss
      if (await arraysHaveSameElements(requestIdsToCheck, results)) {
        console.log(
          "All of the lambda ids are included in the s3 results folder"
        );
        finished = true;
      }
    } catch (e) {
      console.log(e);
    }

    // Count every 5 seconds in order to timeout
    counter += 5;
    if (counter >= timeOutInSecs) {
      timedOut = true;
      setExitCode(1);
      console.log("Timed out after " + timeOutInSecs + " seconds");
    }
    await wait(5000);
  }
  await handleResult();
}
async function main() {
  // Determine execution type
  const { executionTypeInput } = await getInputData();
  handleExecutionType(executionTypeInput);

  // Set and log the runId
  setRunId();
  line();
  console.log("Your run id is: ", colors.magenta(getRunId()));
  line();

  // Set the orgUrl. @TODO grab it from an HTTP request
  setOrgUrl("https://otf.overloop.io/");

  // Execute
  switch (executionType) {
    case "lambda":
      await executeLambdas();
      break;
    default:
      await executeLocal();
  }
}

async function handleResult() {
  // If the exit code is already known, ignore (timeout case)
  if (!getExitCode()) {
    // Grab the failed files from the s3 and store them locally
    await syncFilesFromS3(
      `s3://otf-lambda-results/custom/results/${getRunId()}/results`,
      `logs/failedTestResults`
    );

    // Iterate through the failed test files and determine the failed ids to create the links
    const directory = `./logs/failedTestResults/custom/results/${getRunId()}/results`;
    const failedTestResults = await getFailedTests(directory, "failed-");
    await createFailedLinks(failedTestResults, getOrgUrl());
    failedTestResults.length > 0 ? setExitCode(1) : setExitCode(0);
  }
  process.exit(getExitCode());
}
main();
