const colors = require("colors");
const { clearFeaturePath } = require("./helper");
colors.enable();

function myFormatter(options, params, payload) {
  const bar = options.barCompleteString.substr(
    0,
    Math.round(params.progress * options.barsize)
  );

  // change color to green when finished
  if (params.value >= params.total && payload.result === "passed") {
    return (
      "Test Progress | " +
      colors.green(bar) +
      ` | ${params.value} / ${params.total} | ` +
      colors.green(clearFeaturePath(payload.scenarioName))
    );
    // or to red when failed
  } else if (params.value >= params.total && payload.result === "failed") {
    return (
      "Test Progress | " +
      colors.red(bar) +
      ` | ${params.value} / ${params.total} | ` +
      colors.red(clearFeaturePath(payload.scenarioName))
    );
    // In any other case where you have to update turn it to gray
  } else if (params.value <= params.total) {
    return (
      "Test Progress | " +
      colors.blue(bar) +
      ` | ${params.value} / ${params.total} | ${clearFeaturePath(
        payload.scenarioName
      )}`
    );
  }
}

module.exports = myFormatter;
