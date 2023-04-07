const { wait } = require("./helper");
const {
  createScenarioBars,
  updateScenarioLinesForCI,
  updateScenarioLineIfRequired,
} = require("./reporter");
const colors = require("colors");
const { queryDB } = require("./db");

async function pollResults(arrayToPoll, runId) {
  let counter = 0;
  let timedOut = false;
  let timeOutInSecs = 120;
  let dataAfterExecution = [];
  let listOfFailedScenarios = [];
  let listOfPassedScenarios = [];

  console.log(
    `Setting a ` +
      colors.cyan(`polling timeout of ${timeOutInSecs}`) +
      ` seconds` +
      "\n" +
      "Polling results..."
  );

  let barsHandler = [];
  if (process.env.CI === "false") {
    barsHandler = await createScenarioBars(arrayToPoll);
  }

  // Set the poll timeout
  setTimeout(() => {
    timedOut = true;
  }, timeOutInSecs * 1000);

  while (counter !== arrayToPoll.length && timedOut !== true) {
    dataAfterExecution = await queryDB(runId);
    counter = dataAfterExecution.rows.length;

    if (process.env.CI === "false") {
      await updateScenarioLineIfRequired(
        dataAfterExecution,
        barsHandler.barObjectsScenarios,
        listOfFailedScenarios,
        listOfPassedScenarios
      );
      barsHandler.totalTestsBar.update(counter);
    } else {
      updateScenarioLinesForCI(
        dataAfterExecution,
        arrayToPoll,
        listOfFailedScenarios,
        listOfPassedScenarios
      );
    }
    await wait();
  }
  if (process.env.CI === "false") {
    barsHandler.multibar.stop();
    barsHandler.totalTestsBar.stop();
  }
  return { dataAfterExecution, listOfFailedScenarios };
}

module.exports = {
  pollResults,
};
