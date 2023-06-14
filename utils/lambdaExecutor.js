const {
  getRerun,
  getOrgUrl,
  createRunLinks,
  createFailedLinks,
  setExitCode,
  getExitCode,
  line,
} = require("./helper");
const glob = require("glob");

const {
  handleResult,
  getInputData,
  getFailedLambdaTestResultsFromLocal,
  getLambdaTestResultsFromLocalBasedOnId,
} = require("./handlers");
const {
  sliceFeatureFilesRecursively,
} = require("../utils/slicer_functions/lambdaSlicer");
const { filterFeatureFilesByTag } = require("./filterFunctions/lambdaFilter");
const colors = require("colors");
const {
  pollLambdas,
  pollLambdasWithThrottling,
} = require("./pollingFunctions/lambdaPoller");
const { getLambdaEnvVariables } = require("./envVariables/envVariablesHandler");
colors.enable();

async function executeLambdas() {
  const debug = require("debug")("THROTTLING");
  const { specFiles, s3BucketName, tag } = await getInputData();

  // Get the sliced files based on the provided path and filter them by tag
  const slicedFiles = await sliceFeatureFilesRecursively(specFiles);
  const finalFilesToSendToLambda = await filterFeatureFilesByTag(
    slicedFiles,
    tag
  );
  const envVars = await getLambdaEnvVariables();

  const { listOfLambdasWhichTimedOut } = await pollLambdasWithThrottling(
    finalFilesToSendToLambda,
    envVars
  );
  console.log("RUN FINISHED");

  if (listOfLambdasWhichTimedOut.length > 0) {
    line();
    console.log(
      colors.yellow("Some tests timed out during this run: "),
      listOfLambdasWhichTimedOut
    );
  }
  line();
  // Get the failed tests results from local
  const listOfFailedLambdaTests = await getFailedLambdaTestResultsFromLocal(
    s3BucketName
  );

  if (
    (listOfLambdasWhichTimedOut.length > 0 ||
      listOfFailedLambdaTests.length > 0) &&
    getRerun()
  ) {
    let listOfFilesToRerun = [];
    for (const test of listOfLambdasWhichTimedOut) {
      listOfFilesToRerun.push(test.fileName);
    }

    debug("listOfLambdasWhichTimedOut", listOfLambdasWhichTimedOut);
    debug("listOfFailures", listOfFailedLambdaTests);
    listOfFilesToRerun = [
      ...new Set([...listOfFailedLambdaTests, ...listOfFilesToRerun]),
    ];

    console.log(
      colors.yellow(
        "* There are timed out lambdas or failed tests and rerun has been enabled "
      )
    );
    console.log("Rerunning the below tests", listOfFilesToRerun);
    const {
      allIdsMapped: requestIdsToCheckForRerun,
      listOfLambdasWhichTimedOut: rerunTimedOutLambdasList,
    } = await pollLambdasWithThrottling(listOfFilesToRerun, envVars);
    console.log("RUN FINISHED");
    line();
    const rerunTestResults = await getLambdaTestResultsFromLocalBasedOnId(
      s3BucketName,
      requestIdsToCheckForRerun
    );
    const failedTestResults = rerunTestResults.filter(
      (testResult) => testResult.status === "failed"
    );

    if (rerunTimedOutLambdasList.length > 0) {
      console.log(
        colors.yellow("Some tests timed out during rerun: "),
        rerunTimedOutLambdasList
      );
    }

    createRunLinks(getOrgUrl());
    if (failedTestResults.length > 0) {
      await createFailedLinks(failedTestResults, getOrgUrl());
      setExitCode(1);
    } else {
      setExitCode(0);
    }
    process.exit(getExitCode());
  } else {
    await handleResult(s3BucketName);
  }
}

module.exports = {
  executeLambdas,
};
