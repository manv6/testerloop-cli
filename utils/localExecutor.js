const { handleResult } = require("./handlers");
const { spawn } = require("child_process");
const { createFinalCommand } = require("./handlers");

async function executeLocal() {
  const command = await createFinalCommand();
  console.log("Executing command: ", command);
  const child = spawn(command, { shell: true, stdio: "inherit" });
  if (child.stdout) {
    child.stdout.pipe(process.stdout);
  }

  if (child.stderr) {
    child.stderr.pipe(process.stderr);
  }

  child.on("close", async () => {
    await handleResult();
  });
}

module.exports = {
  executeLocal,
};
