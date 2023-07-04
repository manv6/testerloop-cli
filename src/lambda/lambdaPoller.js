const colors = require("colors");

const { wait, line, getInputData } = require("../utils/helper");
const {
  removeTestFromList,
  handleExecutionTimeout,
  checkLambdaHasTimedOut,
  sendTestsToLambdasBasedOnAvailableSlots,
} = require("../utils/handlers");
const { checkFileExistsInS3 } = require("../s3");
const { debugThrottling } = require("../debug");

async function pollLambdasWithThrottling(allFilesToBeSent, envVars, s3RunPath) {
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
      (totalNumberOfFilesSent && totalNumberOfFilesSent !== allFilesToBeSent.length)) &&
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

      debugThrottling(
        "List of tests to check this iteration: ",
        listOfTestsToCheckResults
      );

      const remainingIds = listOfTestsToCheckResults;
      // Determine if a test has finished or polling has timed out for it
      for (let test of remainingIds) {
        const filePath = `${s3RunPath}/${test.tlTestId}/test.complete`;
        const fileExists = await checkFileExistsInS3(s3BucketName, filePath);
        const lambdaHasTimedOut = await checkLambdaHasTimedOut(
          test,
          lambdaTimeOutSecs
        );

        if (lambdaHasTimedOut) {
          listOfLambdasWhichTimedOut.push(test);
        }
        if (fileExists) {
          console.log("+ Found test.complete file for " + filePath);
        }
        if (lambdaHasTimedOut || fileExists) {
          removeTestFromList(listOfTestsToCheckResults, test);
          availableSlots++;
        }

        debugThrottling(
          `Available slots for next iteration: ${availableSlots}`
        );
        debugThrottling(`Total lambdas triggered: ${totalNumberOfFilesSent}`);
      }
    } catch (e) {
      console.log(e);
    }

    timedOut = await handleExecutionTimeout(timeCounter);
    timeCounter += 5;
    await wait(5000);
  }
  line();
  debugThrottling("Lambdas which timed out: ", listOfLambdasWhichTimedOut);
  debugThrottling("All tests send: ", allRequestIdsSent);
  const allIdsMapped = allRequestIdsSent.map((test) => test.tlTestId);
  return { allIdsMapped, listOfLambdasWhichTimedOut };
}

module.exports = {
  pollLambdasWithThrottling,
};
