const {
  wait,
  line,
  getRunId,
  setExitCode,
  clearFeaturePath,
} = require("./helper");
const glob = require("glob");
const { checkFileExistsInS3 } = require("./s3");
const { sendEventsToLambda } = require("./eventProcessor");
const {
  handleResult,
  getInputData,
  getS3RunPath,
  getEnvVariableValuesFromCi,
} = require("./handlers");
const { cucumberSlicer } = require("cucumber-cypress-slicer");
const colors = require("colors");
colors.enable();

async function executeLambdas() {
  const {
    specFiles,
    lambdaArn,
    timeOutInSecs,
    uploadFilesToS3,
    s3BucketName,
    customPath,
    envVariablesLambda,
  } = await getInputData();

  // Slice the cucumber files
  let filesToExecute = specFiles.includes(".feature")
    ? specFiles
    : specFiles + "/*.feature";
  await cucumberSlicer(filesToExecute, `./cypress/e2e/parsed/`);
  const files = glob
    .sync(`./cypress/e2e/parsed/cypress/e2e/*.feature`)
    .map((file) => `${file}`);
  console.log("LOG: Found files to execute: ", files);

  // Create the reporter variables to pass on to the reporter
  // Leave request id undefined so it can get the one from the lamdba process.env
  const reporterVariables = {
    CYPRESS_TL_RUN_ID: getRunId(),
    CYPRESS_TL_TEST_ID: undefined,
    CYPRESS_TL_S3_BUCKET_NAME: s3BucketName,
    CYPRESS_TL_EXECUTE_FROM: "lambda",
    CYPRESS_TL_CUSTOM_RESULTS_PATH: customPath,
    CYPRESS_TL_UPLOAD_RESULTS_TO_S3: uploadFilesToS3,
  };

  const envVars = { ...reporterVariables };
  let userEnvVarsWithValues = getEnvVariableValuesFromCi(envVariablesLambda);

  userEnvVarsWithValues.forEach((item) => {
    envVars[item.name] = item.value;
  });

  console.log("userEnvVarsWithValues: ", envVars);

  // Send the events to the lambda
  const results = await sendEventsToLambda(files, lambdaArn, envVars);

  // Push the results into an array to handle later for polling
  let requestIdsToCheck = [];
  let listToCheck = [];
  line();
  results.forEach((result, index) => {
    console.log(
      colors.cyan("Test id: "),
      result.$metadata.requestId,
      `   ${clearFeaturePath(files[index])}`
    );
    let test = {
      tlTestId: JSON.stringify(result.$metadata.requestId).replaceAll('"', ""),
      fileName: files[index],
      result: "running",
      startDate: Date.now(),
    };
    requestIdsToCheck.push(test);
  });
  line();

  // Poll for results in s3
  let counter = 0;
  let timedOut = false;
  listToCheck = [...requestIdsToCheck];
  console.log("Polling for test results in s3...");
  line();
  while (listToCheck.length > 0 && timedOut !== true) {
    try {
      const remainingIds = requestIdsToCheck.filter((obj1) =>
        listToCheck.some((obj2) => obj2.tlTestId === obj1.tlTestId)
      );
      for (let test of remainingIds) {
        let filePath = `${getS3RunPath()}/${test.tlTestId}/test.complete`;
        let fileExists = await checkFileExistsInS3(
          s3BucketName,
          filePath.replace(s3BucketName + "/", "")
        );
        if (fileExists) {
          console.log("Found test.complete file for " + filePath);
          // // find the index of the object you want to remove
          let index = listToCheck.findIndex(
            (obj) => obj.tlTestId === test.tlTestId
          );
          // // remove the object from the array using splice()
          if (index !== -1) {
            listToCheck.splice(index, 1);
          }
        }
      }
      line();
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
  await handleResult(s3BucketName, customPath);
}

module.exports = {
  executeLambdas,
};
