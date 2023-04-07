const { line, clearFeaturePath, getRunId } = require("./helper");
const colors = require("colors");
const LCL = require("last-commit-log");
const cliProgress = require("cli-progress");
const myFormatter = require("./cliFormatter");
const lcl = new LCL();
const commit = lcl.getLastCommitSync();

function createRunLink() {
  line();
  console.log("Follow the below link to see the execution details");
  console.log(
    `Run link: ` +
      colors.blue.underline(
        `https://otf.overloop.io/overloop/overloop_otf/${
          commit.gitBranch
        }/${getRunId()}`
      )
  );
  line();
}

function createScenarioLink(requestId, scenarioName) {
  return `https://otf.overloop.io/overloop/overloop_otf/${
    commit.gitBranch
  }/${getRunId()}/${requestId}`;
}

function createReport(
  failedTests,
  passedTests,
  expectedTestCount,
  listOfFailedScenarios
) {
  console.log("Follow the link below link to see the execution details");

  line();
  console.log(
    `Run link: ` +
      colors.blue.underline(
        `https://overloop.io/overloop/overloop_otf/${
          commit.gitBranch
        }/${getRunId()}`
      )
  );
  line();
  console.log(
    `|         ✅ ` + colors.green("Passed") + `: ${passedTests.length}\t|`
  );
  console.log(
    `|         ❌ ` + colors.red("Failed") + `: ${failedTests.length}\t|`
  );
  console.log(
    `|         Total: ${
      failedTests.length + passedTests.length
    } / ${expectedTestCount}\t|`
  );
  line();
  if (failedTests.length > 0 && process.env.CI === "false") {
    createListOfFailedScenarios(listOfFailedScenarios);
  }
}

function createListOfFailedScenarios(list) {
  list.forEach((failedScenario, index) => {
    console.log(
      `| ${index + 1} |` +
        colors.red(failedScenario.scenario) +
        " --> " +
        colors.blue.underline(failedScenario.link)
    );
  });
}

async function createScenarioBars(arrayOfScenarios) {
  return new Promise((resolve) => {
    // Create the multibar instance creator
    const multibar = new cliProgress.MultiBar(
      {
        hideCursor: true,
        format: myFormatter,
      },
      cliProgress.Presets.shades_grey
    );

    // Create and push the progress bars for each scenario
    const barObjectsScenarios = [];
    arrayOfScenarios.forEach((request) => {
      barObjectsScenarios.push({
        barObj: multibar.create(1, 0, { scenarioName: request.fileName }),
        requestId: request.requestId,
        fileName: request.fileName,
      });
    });
    // Create the custom bar for total tests counting

    const totalTestsBar = multibar.create(
      arrayOfScenarios.length,
      0,
      {},
      {
        format:
          "Total tests   | " +
          colors.blue("{bar}") +
          " | {percentage}% || {value} / {total} tests | {duration} seconds",
      }
    );

    resolve({ barObjectsScenarios, totalTestsBar, multibar });
  });
}

async function updateScenarioLineIfRequired(
  polledResults,
  barObjectsScenarios,
  listOfFailedScenarios
) {
  return new Promise(async (resolve) => {
    polledResults.rows.forEach((entry) => {
      if (entry.result.trim() === "passed") {
        const itemToUpdate = barObjectsScenarios.filter(
          (obj) => obj.requestId === entry.id
        )[0];
        itemToUpdate.barObj.update(1, {
          result: entry.result.trim(),
          scenarioName: itemToUpdate.fileName,
        });
      } else if (
        entry.result.trim() === "failed" &&
        !checkIfResultAlreadyProcessed(entry.id, listOfFailedScenarios)
      ) {
        const itemToUpdate = barObjectsScenarios.filter(
          (obj) => obj.requestId === entry.id
        )[0];
        itemToUpdate.barObj.update(1, {
          result: entry.result.trim(),
          featureName: itemToUpdate.fileName,
        });
        listOfFailedScenarios.push({
          requestId: entry.id,
          scenario: clearFeaturePath(itemToUpdate.fileName),
          link: createScenarioLink(
            entry.id,
            clearFeaturePath(itemToUpdate.fileName)
          ),
        });
      }
    });
    resolve(true);
  });
}

async function updateScenarioLinesForCI(
  polledResults,
  originalArrayWithScenarios,
  listOfFailedScenarios,
  listOfPassedScenarios
) {
  return new Promise(async (resolve) => {
    polledResults.rows.forEach((entry) => {
      if (
        entry.result.trim() === "passed" &&
        !checkIfResultAlreadyProcessed(entry.id, listOfPassedScenarios)
      ) {
        const itemToUpdate = originalArrayWithScenarios.filter(
          (item) => item.requestId === entry.id
        )[0];
        listOfPassedScenarios.push({
          requestId: entry.id,
          scenario: clearFeaturePath(itemToUpdate.fileName),
          link: createScenarioLink(
            entry.id,
            clearFeaturePath(itemToUpdate.fileName)
          ),
        });
        console.log(
          colors.green("Scenario passed") +
            " --> " +
            colors.green(clearFeaturePath(itemToUpdate.fileName))
        );
      } else if (
        entry.result.trim() === "failed" &&
        !checkIfResultAlreadyProcessed(entry.id, listOfFailedScenarios)
      ) {
        const itemToUpdate = originalArrayWithScenarios.filter(
          (item) => item.requestId === entry.id
        )[0];
        listOfFailedScenarios.push({
          requestId: entry.id,
          scenario: clearFeaturePath(itemToUpdate.fileName),
          link: createScenarioLink(
            entry.id,
            clearFeaturePath(itemToUpdate.fileName)
          ),
        });
        console.log(
          colors.red("Scenario failed") +
            " --> " +
            colors.red(clearFeaturePath(itemToUpdate.fileName)) +
            "\n" +
            colors.white.underline(
              createScenarioLink(
                entry.id,
                clearFeaturePath(itemToUpdate.fileName)
              )
            )
        );
      }
    });
    resolve(true);
  });
}

function checkIfResultAlreadyProcessed(
  requestId,
  listOfObjectsToCheckIfIncluded
) {
  return listOfObjectsToCheckIfIncluded.some(
    (item) => item.requestId === requestId
  );
}

async function determineExecutionResult(
  data,
  expectedTestCount,
  listOfFailedScenarios
) {
  let finalStatus = "";
  const failedTests = data.rows.filter(
    (item) => item.result.trim() === "failed"
  );
  const passedTests = data.rows.filter(
    (item) => item.result.trim() === "passed"
  );
  line();
  // Determined if failed tests
  if (
    failedTests.length > 0 &&
    failedTests.length + passedTests.length === expectedTestCount
  ) {
    console.log("Finished execution with errors!");
    createReport(
      failedTests,
      passedTests,
      expectedTestCount,
      listOfFailedScenarios,
      getRunId()
    );
    finalStatus = "failed";
  }
  // Determined if passed tests
  else if (
    failedTests.length === 0 &&
    failedTests.length + passedTests.length === expectedTestCount
  ) {
    console.log("Finished execution successfully!");
    finalStatus = "passed";
    createReport(
      failedTests,
      passedTests,
      expectedTestCount,
      listOfFailedScenarios,
      getRunId()
    );
  }
  // Determined if unfinished tests
  else if (failedTests.length + passedTests.length !== expectedTestCount) {
    console.log(
      "****** SOME TESTS DID NOT FINISH WITHIN THE 60 seconds LIMIT *******"
    );
    createReport(
      failedTests,
      passedTests,
      expectedTestCount,
      listOfFailedScenarios,
      getRunId()
    );
  }
  return finalStatus;
}

function failOrPassBuild(finalStatus) {
  if (finalStatus === "failed") {
    process.exit(1);
  } else process.exit(0);
}

module.exports = {
  createReport,
  createRunLink,
  failOrPassBuild,
  createScenarioLink,
  createScenarioBars,
  determineExecutionResult,
  createListOfFailedScenarios,
  updateScenarioLinesForCI,
  updateScenarioLineIfRequired,
  checkIfResultAlreadyProcessed,
  commit,
};
