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
const { initializeLogger } = require('./src/logger/logger');
const { showIntroMessage } = require('./src/logger/introMessage');

colors.enable();

async function main() {
  showIntroMessage();
  const {
    executionTypeInput,
    reporterBaseUrl,
    s3BucketName,
    customPath,
    help,
  } = await getInputData();
  if (help) {
    showHelp(help);
  } else {
    // Set and org base url for the links & the runId
    const runId = getNewRunId();
    const logger = initializeLogger(s3BucketName, customPath, runId);

    const s3RunPath = getS3RunPath(s3BucketName, customPath, runId);
    createAndUploadCICDFileToS3Bucket(s3BucketName, s3RunPath);
    line();

    logger.info(
      'Your run id is: ' +
        colors.magenta(runId) +
        '  -> ' +
        `${reporterBaseUrl}/run/${runId}`,
      {
        runId,
        executionTypeInput,
        reporterBaseUrl,
        s3BucketName,
        customPath,
        help,
      },
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
