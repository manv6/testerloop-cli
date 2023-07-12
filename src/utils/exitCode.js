let exitCode;

function getExitCode() {
  return exitCode;
}

function setExitCode(code) {
  return (exitCode = code);
}

module.exports = {
  getExitCode,
  setExitCode,
};
