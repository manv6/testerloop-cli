const arg = require('arg');

function parseArguments() {
  const args = arg({}, { permissive: true });
  const cliArgs = args._;

  return cliArgs;
}

async function clearTheArgs(argsToRemoveArray) {
  const args = arg({}, { permissive: true });

  console.log('args', args);
  const getArgs = async () => {
    return args._;
  };

  return getArgs().then((cliArgs) => {
    for (const argToRemove of argsToRemoveArray) {
      const argIndex = cliArgs.indexOf(argToRemove.argName);

      if (argIndex !== -1 && argIndex < cliArgs.length - 1) {
        if (argToRemove.hasValue) {
          cliArgs.splice(argIndex, 2);
        } else {
          cliArgs.splice(argIndex, 1);
        }
      }
    }

    return cliArgs;
  });
}

module.exports = {
  parseArguments,
  clearTheArgs,
};
