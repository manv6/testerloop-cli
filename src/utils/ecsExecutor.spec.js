jest.mock("./helper", () => ({
  getInputData: jest.fn(),
}));

jest.mock("./handlers", () => ({
  handleResult: jest.fn(),
  determineFilePropertiesBasedOnTags: jest.fn(),
}));

const specFiles = "test.feature";

describe("ecsExecutor", () => {
  describe("executeEcs", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("ecs executor", async () => {});
  });
});
