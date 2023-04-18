const {
  wait,
  line,
  getRunId,
  setExitCode,
  clearFeaturePath,
  arraysHaveSameElements,
} = require("./helper");
const glob = require("glob");
const { listS3Folders } = require("./s3");
const { sendEventsToLambda } = require("./eventProcessor");
const { handleResult, getInputData } = require("./handlers");
const { cucumberSlicer } = require("cucumber-cypress-slicer");

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

module.exports = {
  executeLambdas,
};
