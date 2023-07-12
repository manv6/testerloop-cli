const winston = require('winston');
const { S3StreamLogger } = require('s3-streamlogger');

const { getExitCode } = require('../utils/exitCode');

let logger;
let s3_stream;
let pollingIntervalId;

function clearLogger() {
  logger = undefined;
}

function endLogStream() {
  s3_stream.end();
  pollingIntervalId = setInterval(checkWritableFinished, pollingInterval);
}

function getLogger() {
  if (!logger) {
    throw Error('No logger');
  }
  return logger;
}
function silentLog(logger, payload) {
  try {
    logger.transports[0].silent = true;
    logger.log('info', payload);
    logger.transports[0].silent = false;
  } catch (err) {}
}

const pollingInterval = 1000; // 1 second

function checkWritableFinished() {
  if (s3_stream.writableFinished) {
    clearInterval(pollingIntervalId); // Stop polling
    console.log('Testerloop CLI exited with exit code: ', getExitCode());
    process.exit(getExitCode());
  }
}

function initializeLogger(bucketName, customPath, runId) {
  if (logger) {
    return logger;
  }
  s3_stream = new S3StreamLogger({
    bucket: bucketName, //make env variable or clip parameter
    folder: `${customPath}/${runId}/logs`, // env variable or cli parameter
    name_format: 'cli-logs-%Y-%m-%d-%H-%M-%S-%L',
  });

  const stream_transport = new winston.transports.Stream({
    stream: s3_stream,
  });

  logger = winston.createLogger({
    levels: winston.config.syslog.levels,

    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        name: 'console',
        level: process.env.DEBUG === 'true' ? 'debug' : 'info',

        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(
            ({ timestamp, level, message }) =>
              `${level} ${timestamp} : ${message}`,
          ),
        ),
      }),
      stream_transport,
    ],
  });
  return logger;
}

module.exports = {
  getLogger,
  initializeLogger,
  clearLogger,
  silentLog,
  endLogStream,
};
