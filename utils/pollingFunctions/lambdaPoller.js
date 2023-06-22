const { wait, line, getInputData, getS3RunPath } = require("../helper");
const {
  removeTestFromList,
  handleExecutionTimeout,
  checkLambdaHasTimedOut,
  sendTestsToLambdasBasedOnAvailableSlots,
} = require("../handlers");
const { checkFileExistsInS3 } = require("../s3");
const colors = require("colors");

async function pollLambdasWithThrottling(allFilesToBeSent, envVars) {
  const debug = require("debug")("THROTTLING");
  colors.enable();
  let { lambdaTimeOutSecs, s3BucketName, lambdaThreads, lambdaArn } =
    await getInputData();

  // If no lambda threads specified, then trigger all the available tests
  lambdaThreads =
    lambdaThreads === 0 || lambdaThreads === undefined
      ? allFilesToBeSent.length
      : lambdaThreads;

  let listOfTestsToCheckResults = [];
  let requestIdsToCheck = [];
  let availableSlots = lambdaThreads;
  let totalNumberOfFilesSent = 0;
  let listOfLambdasWhichTimedOut = [];
  let allRequestIdsSent = [];

  requestIdsToCheck = await sendTestsToLambdasBasedOnAvailableSlots(
    allFilesToBeSent,
    availableSlots,
    totalNumberOfFilesSent,
    lambdaThreads,
    lambdaArn,
    envVars
  );
  availableSlots = 0;
  totalNumberOfFilesSent = requestIdsToCheck.length;
  listOfTestsToCheckResults = [...requestIdsToCheck];
  allRequestIdsSent = [...requestIdsToCheck];

  line();
  console.log("Polling for test results in s3...");
  console.log(`Using ${lambdaThreads} number of parallel lambdas`);
  line();
  let timeCounter = 0;
  let timedOut = false;
  while (
    (listOfTestsToCheckResults.length > 0 ||
      totalNumberOfFilesSent !== allFilesToBeSent.length) &&
    timedOut !== true
  ) {
    try {
      let newRequestIdsToCheck = [];
      newRequestIdsToCheck = await sendTestsToLambdasBasedOnAvailableSlots(
        allFilesToBeSent,
        availableSlots,
        totalNumberOfFilesSent,
        lambdaThreads,
        lambdaArn,
        envVars
      );
      availableSlots = 0;
      totalNumberOfFilesSent += newRequestIdsToCheck.length;
      allRequestIdsSent = [...allRequestIdsSent, ...newRequestIdsToCheck];

      listOfTestsToCheckResults = [
        ...listOfTestsToCheckResults,
        ...newRequestIdsToCheck,
      ];

      debug(
        "List of tests to check this iteration: ",
        listOfTestsToCheckResults
      );

      const remainingIds = listOfTestsToCheckResults;
      // Determine if a test has finished or polling has timed out for it
      for (let test of remainingIds) {
        const filePath = `${getS3RunPath()}/${test.tlTestId}/test.complete`;
        const fileExists = await checkFileExistsInS3(
          s3BucketName,
          filePath.replace(s3BucketName + "/", "")
        );
        const lambdaHasTimedOut = await checkLambdaHasTimedOut(
          test,
          lambdaTimeOutSecs
        );

        if (fileExists || lambdaHasTimedOut) {
          if (lambdaHasTimedOut) {
            listOfLambdasWhichTimedOut.push(test);
          }
          console.log("+ Found test.complete file for " + filePath);
          removeTestFromList(listOfTestsToCheckResults, test);
          availableSlots++;
        }
        debug(`Available slots for next iteration: ${availableSlots}`);
        debug(`Total lambdas triggered: ${totalNumberOfFilesSent}`);
      }
    } catch (e) {
      console.log(e);
    }

    timedOut = await handleExecutionTimeout(timeCounter);
    timeCounter += 5;
    await wait(5000);
  }
  line();
  debug("Lambdas which timed out: ", listOfLambdasWhichTimedOut);
  debug("All tests send: ", allRequestIdsSent);
  const allIdsMapped = allRequestIdsSent.map((test) => test.tlTestId);
  return { allIdsMapped, listOfLambdasWhichTimedOut };
}

module.exports = {
  pollLambdasWithThrottling,
};
