#!/usr/bin/env node

const colors = require('colors');

const { createAndUploadCICDFileToS3Bucket } = require('./src/utils/handlers');
const { executeEcs } = require('./src/ecs/ecsExecutor');
const { executeLocal } = require('./src/local/localExecutor');
const { executeLambdas } = require('./src/lambda/lambdaExecutor');
const {
  getInputData,
  line,
  getNewRunId,
  getS3RunPath,
  showHelp,
} = require('./src/utils/helper');

colors.enable();

async function main() {
  const {
    executionTypeInput,
    reporterBaseUrl,
    s3BucketName,
    customPath,
    help,
    ecsRegion,
    lambdaRegion,
  } = await getInputData();
  if (help) {
    showHelp(help);
  } else {
    // Set and org base url for the links & the runId
    const runId = getNewRunId();
    const s3RunPath = getS3RunPath(s3BucketName, customPath, runId);
    createAndUploadCICDFileToS3Bucket(s3BucketName, s3RunPath);
    line();
    console.log(
      'Your run id is: ',
      colors.magenta(runId) + '  -> ' + `${reporterBaseUrl}/run/${runId}`,
    );
    line();

    // Execute
    switch (executionTypeInput) {
      case 'lambda':
        await executeLambdas(runId, s3RunPath);
        break;
      case 'ecs':
        await executeEcs(runId, s3RunPath);
        break;
      default:
        await executeLocal(runId, s3RunPath);
    }
  }
}

main();
