const {
  createRunLinks,
  createFailedLinks,
  setExitCode,
  getExitCode,
  line,
  getInputData,
} = require("../utils/helper");

const {
  handleResult,
  getFailedLambdaTestResultsFromLocal,
  getLambdaTestResultsFromLocalBasedOnId,
} = require("../utils/handlers");
const {
  sliceFeatureFilesRecursively,
} = require("./lambdaSlicer");
const { filterFeatureFilesByTag } = require("./lambdaFilter");
const colors = require("colors");
const {
  pollLambdasWithThrottling,
} = require("./lambdaPoller");
const { getLambdaEnvVariables } = require("../utils/envVariables/envVariablesHandler");
const { debugThrottling } = require("../debug");
colors.enable();

async function executeLambdas(runId, s3RunPath) {
  const { specFilesPath, s3BucketName, tag, rerun, reporterBaseUrl } =
    await getInputData();

  // Get the sliced files based on the provided path and filter them by tag
  const slicedFiles = await sliceFeatureFilesRecursively(specFilesPath);
  const finalFilesToSendToLambda = await filterFeatureFilesByTag(
    slicedFiles,
    tag
  );
  const envVars = await getLambdaEnvVariables(runId);

  const { listOfLambdasWhichTimedOut } = await pollLambdasWithThrottling(
    finalFilesToSendToLambda,
    envVars,
    s3RunPath
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
    s3BucketName,
    s3RunPath
  );

  if (
    (listOfLambdasWhichTimedOut.length > 0 ||
      listOfFailedLambdaTests.length > 0) &&
    rerun
  ) {
    let listOfFilesToRerun = [];
    for (const test of listOfLambdasWhichTimedOut) {
      listOfFilesToRerun.push(test.fileName);
    }

    debugThrottling("listOfLambdasWhichTimedOut", listOfLambdasWhichTimedOut);
    debugThrottling("listOfFailures", listOfFailedLambdaTests);
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
    } = await pollLambdasWithThrottling(listOfFilesToRerun, envVars, s3RunPath);
    console.log("RUN FINISHED");
    line();
    const rerunTestResults = await getLambdaTestResultsFromLocalBasedOnId(
      s3BucketName,
      requestIdsToCheckForRerun,
      s3RunPath
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

    await createRunLinks(reporterBaseUrl, runId);
    if (failedTestResults.length > 0) {
      await createFailedLinks(runId, failedTestResults, reporterBaseUrl);
      setExitCode(1);
    } else {
      setExitCode(0);
    }
    process.exit(getExitCode());
  } else {
    await handleResult(s3BucketName, s3RunPath, runId);
  }
}

module.exports = {
  executeLambdas,
};
