const { getRunId } = require("./helper");
const { spawn } = require("child_process");
const {
  handleResult,
  createFinalCommand,
  getInputData,
} = require("./handlers");

async function executeLocal() {
  const { s3BucketName, customPath, uploadFilesToS3 } = await getInputData();

  const reporterVariables = {
    TL_RUN_ID: getRunId(),
    TL_TEST_ID: undefined,
    TL_S3_BUCKET_NAME: s3BucketName,
    TL_EXECUTE_FROM: "local",
    TL_CUSTOM_RESULTS_PATH: customPath,
    TL_UPLOAD_RESULTS_TO_S3: uploadFilesToS3,
  };

  let reporterVariablesString = "";

  for (const key in reporterVariables) {
    if (
      reporterVariables.hasOwnProperty(key) &&
      reporterVariables[key] !== undefined
    ) {
      reporterVariablesString += `CYPRESS_${key}=${reporterVariables[key]} `;
    }
  }
  reporterVariablesString = reporterVariablesString.trim();

  let command = await createFinalCommand(false);
  console.log("Executing command: ", command);
  command = reporterVariablesString + " " + command;

  const child = spawn(command, { shell: true, stdio: "inherit" });
  if (child.stdout) {
    child.stdout.pipe(process.stdout);
  }

  if (child.stderr) {
    child.stderr.pipe(process.stderr);
  }

  child.on("close", async () => {
    await handleResult(s3BucketName, customPath);
  });
}

module.exports = {
  executeLocal,
};
