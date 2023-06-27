const { getInputData } = require("./helper");
const { spawn } = require("child_process");
const { handleResult, createFinalCommand } = require("./handlers");

async function executeLocal(runId, s3RunPath) {
  const { s3BucketName, uploadFilesToS3, customPath, s3Region } =
    await getInputData();

  const reporterVariables = {
    TL_RUN_ID: runId,
    TL_TEST_ID: undefined,
    TL_S3_BUCKET_NAME: s3BucketName,
    TL_EXECUTE_FROM: "local",
    TL_CUSTOM_RESULTS_PATH: customPath,
    TL_UPLOAD_RESULTS_TO_S3: uploadFilesToS3,
    TL_S3_REGION: s3Region,
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
    await handleResult(s3BucketName, s3RunPath, runId);
  });
}

module.exports = {
  executeLocal,
};
