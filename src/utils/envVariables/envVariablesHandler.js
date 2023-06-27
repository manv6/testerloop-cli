const {
  getEnvVariableValuesFromCi,
  getEnvVariableWithValues,
} = require("../handlers");
const { getInputData } = require("../helper");

async function getLambdaEnvVariables(runId) {
  const {
    envVariablesLambda,
    envVariablesLambdaWithValues,
    s3BucketName,
    customPath,
    uploadFilesToS3,
    s3Region,
  } = await getInputData();

  const reporterBaseVariables = {
    CYPRESS_TL_RUN_ID: runId,
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

async function getEcsEnvVariables(runId) {
  const {
    envVariablesECS,
    envVariablesECSWithValues,
    s3BucketName,
    customPath,
    uploadFilesToS3,
    s3Region,
  } = await getInputData();

  let envVariablesWithValueToPassOnCommand = [
    ...getEnvVariableValuesFromCi(envVariablesECS),
    ...getEnvVariableWithValues(envVariablesECSWithValues),
  ];

  const reporterBaseVariables = {
    TL_RUN_ID: runId,
    TL_TEST_ID: undefined,
    TL_S3_BUCKET_NAME: s3BucketName,
    TL_EXECUTE_FROM: "local",
    TL_CUSTOM_RESULTS_PATH: customPath,
    TL_UPLOAD_RESULTS_TO_S3: uploadFilesToS3,
    TL_S3_REGION: s3Region,
  };
  reporterBaseVariables["TL_EXECUTE_FROM"] = "ecs";
  // Add to the variables to be set on the container the reporter ones with CYPRESS_ prefix
  const reporterVariablesAsCypressVariables = Object.entries(
    reporterBaseVariables
  )
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => ({
      name: "CYPRESS_" + key,
      value: value.toString(),
    }));
  envVariablesWithValueToPassOnCommand =
    envVariablesWithValueToPassOnCommand.concat(
      reporterVariablesAsCypressVariables
    );
  return envVariablesWithValueToPassOnCommand;
}

module.exports = {
  getLambdaEnvVariables,
  getEcsEnvVariables,
};
