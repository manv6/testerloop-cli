const colors = require('colors');

colors.enable();
const { version } = require('../../package.json');

// Read package.json file to get the version from the module
const packageVersion = version;
const logMessage = colors.red(`Testerloop CLI version: ${packageVersion}`);

const messageLength = Math.max(logMessage.length);
const contentLength = messageLength + 4;

const horizontalLine = '-'.repeat(contentLength);
const emptyLine = `|${' '.repeat(contentLength - 2)}|`;
const contentLine = `| ${logMessage.padEnd(messageLength)}           |`;

function showIntroMessage() {
  console.log(horizontalLine);
  console.log(emptyLine);
  console.log(contentLine);
  console.log(emptyLine);
  console.log(horizontalLine);
}

module.exports = {
  showIntroMessage,
};
