const { getExitCode, setExitCode } = require('./exitCode');

describe('Exit Code', () => {
  test('getExitCode should return the exit code', () => {
    const code = 123;
    setExitCode(code);
    expect(getExitCode()).toBe(code);
  });

  test('setExitCode should set the exit code', () => {
    const code = 456;
    setExitCode(code);
    expect(getExitCode()).toBe(code);
  });
});
