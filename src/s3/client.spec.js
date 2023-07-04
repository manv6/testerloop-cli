const { S3Client } = require("@aws-sdk/client-s3");

const { getInputData } = require("../utils/helper");
const { getS3Client, clearClient } = require("./client");

jest.mock("@aws-sdk/client-s3");
jest.mock("../utils/helper");

describe("S3 Client", () => {
  afterEach(() => {
    jest.resetAllMocks();
    clearClient();
  });

  it("should create a new S3Client with the region from getInputData if no client is currently initialized", () => {
    const mockS3Region = "us-west-2";
    const mockClient = { region: mockS3Region };

    getInputData.mockReturnValueOnce({ s3Region: mockS3Region });
    S3Client.mockReturnValueOnce(mockClient);

    const client = getS3Client();

    expect(client).toEqual(mockClient);
    expect(S3Client).toHaveBeenCalledWith({ region: mockS3Region });
  });

  it("should return an already initialized S3Client", () => {
    const mockS3Region = "us-west-2";
    const mockClient = { region: mockS3Region };

    getInputData.mockReturnValueOnce({ s3Region: mockS3Region });
    S3Client.mockReturnValueOnce(mockClient);

    const firstCallClient = getS3Client();
    const secondCallClient = getS3Client();

    expect(firstCallClient).toBe(secondCallClient);
    expect(S3Client).toHaveBeenCalledTimes(1);
  });
});

