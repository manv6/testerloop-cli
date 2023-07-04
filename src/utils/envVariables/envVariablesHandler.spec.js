const {
  getEnvVariableWithValues,
  getEnvVariableValuesFromCi,
} = require('../handlers');
const { getInputData } = require('../helper');
const {
  getLambdaEnvVariables,
  getEcsEnvVariables,
} = require('../../utils/envVariables/envVariablesHandler');

jest.mock('../../utils/handlers');
jest.mock('../../utils/helper');

describe('getLambdaEnvVariables', () => {
  test('returns the expected environment variables - lambda', async () => {
    // Arrange
    const envVariablesLambdaWithValues = [
      { name: 'VAR_THREE', value: 'value3' },
    ];
    const envVariablesLambdaWithValuesAfterRetrieveValuesFromCI = [
      { name: 'VAR_ONE', value: 'value1' },
      { name: 'VAR_TWO', value: 'value2' },
    ];

    const mockedInputData = {
      envVariablesLambda: ['VAR_ONE', 'VAR_TWO'],
      envVariablesLambdaWithValues,
      s3BucketName: 'bucket-name',
      customPath: 'results/custom',
      uploadFilesToS3: true,
      s3Region: 'us-west-2',
    };
    const runId = '12345';

    const expectedVariables = {
      CYPRESS_TL_RUN_ID: runId,
      CYPRESS_TL_TEST_ID: undefined,
      CYPRESS_TL_S3_BUCKET_NAME: mockedInputData.s3BucketName,
      CYPRESS_TL_EXECUTE_FROM: 'lambda',
      CYPRESS_TL_CUSTOM_RESULTS_PATH: mockedInputData.customPath,
      CYPRESS_TL_UPLOAD_RESULTS_TO_S3: mockedInputData.uploadFilesToS3,
      CYPRESS_TL_S3_REGION: mockedInputData.s3Region,
      VAR_ONE: 'value1',
      VAR_TWO: 'value2',
      VAR_THREE: 'value3',
    };
    getInputData.mockResolvedValue(mockedInputData);

    getEnvVariableWithValues.mockReturnValue(envVariablesLambdaWithValues);
    getEnvVariableValuesFromCi.mockReturnValue(
      envVariablesLambdaWithValuesAfterRetrieveValuesFromCI,
    );

    // Act
    const result = await getLambdaEnvVariables(runId);

    // Assert
    expect(result).toEqual(expectedVariables);
  });
});

describe('getEcsEnvVariables', () => {
  test('returns the expected environment variables - ecs', async () => {
    // Arrange
    const envVariablesEcsWithValues = [{ name: 'VAR_THREE', value: 'value3' }];
    const envVariablesEcsWithValuesAfterRetrieveValuesFromCI = [
      { name: 'VAR_ONE', value: 'value1' },
      { name: 'VAR_TWO', value: 'value2' },
    ];
    const mockedInputData = {
      envVariablesEcs: ['VAR_ONE', 'VAR_TWO'],
      envVariablesEcsWithValues: {
        VAR_THREE: 'value3',
      },
      s3BucketName: 'bucket-name',
      customPath: 'results/custom',
      uploadFilesToS3: true,
      s3Region: 'us-west-2',
    };
    const runId = '12345';

    const expectedVariables = [
      { name: 'VAR_ONE', value: 'value1' },
      { name: 'VAR_TWO', value: 'value2' },
      { name: 'VAR_THREE', value: 'value3' },
      { name: 'CYPRESS_TL_RUN_ID', value: runId },
      {
        name: 'CYPRESS_TL_S3_BUCKET_NAME',
        value: mockedInputData.s3BucketName,
      },
      { name: 'CYPRESS_TL_EXECUTE_FROM', value: 'ecs' },
      {
        name: 'CYPRESS_TL_CUSTOM_RESULTS_PATH',
        value: mockedInputData.customPath,
      },
      {
        name: 'CYPRESS_TL_UPLOAD_RESULTS_TO_S3',
        value: mockedInputData.uploadFilesToS3.toString(),
      },
      { name: 'CYPRESS_TL_S3_REGION', value: mockedInputData.s3Region },
    ];

    getInputData.mockResolvedValue(mockedInputData);

    getEnvVariableWithValues.mockReturnValue(envVariablesEcsWithValues);
    getEnvVariableValuesFromCi.mockReturnValue(
      envVariablesEcsWithValuesAfterRetrieveValuesFromCI,
    );

    // Act
    const result = await getEcsEnvVariables(runId);

    // Assert
    expect(result).toEqual(expectedVariables);
  });
});
