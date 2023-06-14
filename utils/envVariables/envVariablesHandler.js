const {
  getInputData,
  getEnvVariableValuesFromCi,
  getEnvVariableWithValues,
} = require("../handlers");
const { getRunId } = require("../helper");

async function getLambdaEnvVariables() {
  const {
    envVariablesLambda,
    envVariablesLambdaWithValues,
    s3BucketName,
    customPath,
    uploadFilesToS3,
    s3Region,
  } = await getInputData();

  const reporterBaseVariables = {
    CYPRESS_TL_RUN_ID: getRunId(),
    CYPRESS_TL_TEST_ID: undefined,
    CYPRESS_TL_S3_BUCKET_NAME: s3BucketName,
    CYPRESS_TL_EXECUTE_FROM: "local",
    CYPRESS_TL_CUSTOM_RESULTS_PATH: customPath,
    CYPRESS_TL_UPLOAD_RESULTS_TO_S3: uploadFilesToS3,
    CYPRESS_TL_S3_REGION: s3Region,
  };

  // Create the reporter variables to pass on to the reporter
  // Leave request id undefined so it can get the one from the lamdba process.env
  reporterBaseVariables["CYPRESS_TL_EXECUTE_FROM"] = "lambda";

  const envVars = { ...reporterBaseVariables };
  let userEnvVarsWithValues = [
    ...getEnvVariableValuesFromCi(envVariablesLambda),
    ...getEnvVariableWithValues(envVariablesLambdaWithValues),
  ];

  userEnvVarsWithValues.forEach((item) => {
    envVars[item.name] = item.value;
  });
  return envVars;
}

module.exports = {
  getLambdaEnvVariables,
};
