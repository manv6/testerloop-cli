const handlers = require("./handlers");
async function handleExecutionTypeInput(input) {
  switch (input) {
    case "lambda":
      handlers.setExecutionType("lambda");
      break;
    case "ecs":
      handlers.setExecutionType("ecs");
      break;
    case "local-parallel":
      handlers.setExecutionType("local-parallel");
      break;
    default:
      handlers.setExecutionType("local");
  }
}

module.exports = {
  handleExecutionTypeInput,
};
