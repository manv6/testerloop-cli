const arg = require('arg');

const { parseArguments, clearTheArgs } = require('./argumentsParser');

jest.mock('arg');

const args = { _: ['arg1', 'arg2', 'arg3'] };
describe('parseArguments function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should parse arguments correctly', () => {
    arg.mockReturnValue(args);

    const cliArgs = parseArguments();

    expect(cliArgs).toEqual(['arg1', 'arg2', 'arg3']);
  });
});

describe('clearTheArgs function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should clear specified arguments', async () => {
    arg.mockReturnValue({
      _: ['--arg1', 'value1', '--arg2', '--arg3', 'value3'],
    });

    const argsToRemove = [
      { argName: '--arg1', hasValue: true },
      { argName: '--arg2', hasValue: false },
    ];

    const cliArgs = await clearTheArgs(argsToRemove);

    expect(cliArgs).toEqual(['--arg3', 'value3']);
  });

  it('should not fail if argument to remove is not found', async () => {
    arg.mockReturnValue({ _: ['--arg1', 'value1', '--arg3', 'value3'] });

    const argsToRemove = [{ argName: '--arg2', hasValue: false }];

    const cliArgs = await clearTheArgs(argsToRemove);

    expect(cliArgs).toEqual(['--arg1', 'value1', '--arg3', 'value3']);
  });
});
