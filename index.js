#!/usr/bin/env node

const yargs = require("yargs");
const { spawn } = require("child_process");
/* eslint-disable max-len */
/* eslint-disable no-console */

const {
  setRunId,
  getRunId,
  getFailedTests,
  createFailedLinks,
} = require("./utils/helper");
const { syncFilesFromS3 } = require("./utils/s3");

// Manage payload or finalCommand
// local - OK
// lambda - @TODO
// local-parallel - @TODO
// ecs - @TODO
const argv = yargs
  .option("config-file", {
    alias: "c",
    describe: "Cypress configuration file to use",
    type: "string",
    default: "cypress.config.js",
  })
  .option("spec", {
    alias: "s",
    describe: "Spec file to use",
    type: "string",
  })
  .option("browser", {
    alias: "b",
    describe: "Browser to use",
    type: "string",
    default: "chrome",
  })
  .option("group", {
    alias: "gp",
    describe: "Group to use when running on parallel",
    type: "string",
    default: false,
    demandOption: false,
  })
  .option("key", {
    alias: "k",
    describe: "Cypress cloud key to use",
    type: "string",
    default: false,
    demandOption: false,
  })
  .option("testerloopId", {
    alias: "i",
    describe: "Testerloop organisation key id to use",
    type: "string",
    default: false,
    demandOption: false,
  })
  .help().argv;

const headless = argv["headless"];
const record = argv["record"];
const parallel = argv["parallel"];

// @TODO
// call testerloop server with payload {
// orgId: argv.testerloopId
// }
// Get the orgURL

const orgURL = "https://otf.overloop.io/";

const cypressCommand =
  `npx cypress run --spec ${argv.spec} --browser ${argv.browser} --config-file ${argv.configFile} --key ${argv.key} --group ${argv.group}` +
  (headless ? " --headless" : "") +
  (record ? " --record" : "") +
  (parallel ? " --parallel" : "");

console.log(`Executing command: ${cypressCommand}`);

const colors = require("colors");
colors.enable();
setRunId();

console.log("-----------------------------------------------------");
console.log("Your run id is: ", colors.magenta(getRunId()));
console.log("-----------------------------------------------------");

const finalCypressCommand = "RUN_ID=" + getRunId() + " " + cypressCommand;
const child = spawn(finalCypressCommand, { shell: true, stdio: "inherit" });
if (child.stdout) {
  child.stdout.pipe(process.stdout);
}

if (child.stderr) {
  child.stderr.pipe(process.stderr);
}

child.on("exit", async (code) => {
  await syncFilesFromS3(
    `s3://otf-lambda-results/custom/results/${getRunId()}/results`,
    "logs/failedTestResults"
  );

  const directory = `./logs/failedTestResults/custom/results/${getRunId()}/results`;
  await createFailedLinks(await getFailedTests(directory, "failed-"), orgURL);

  process.exit(code);
});
