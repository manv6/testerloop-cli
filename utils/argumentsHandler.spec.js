const {} = require("./handlers");
const { handleExecutionTypeInput } = require("./argumentsHandler");
const handlers = require("./handlers");

describe("argumentsHandler", () => {
  describe("handleExecutionTypeInput", () => {
    beforeEach(() => {
      handlers.setExecutionType = jest.fn();
    });

    test("should set execution type to lambda when input is lambda", async () => {
      await handleExecutionTypeInput("lambda");
      expect(handlers.setExecutionType).toHaveBeenCalledWith("lambda");
    });

    test("should set execution type to ecs when input is ecs", async () => {
      await handleExecutionTypeInput("ecs");
      expect(handlers.setExecutionType).toHaveBeenCalledWith("ecs");
    });

    test("should set execution type to local-parallel when input is local-parallel", async () => {
      await handleExecutionTypeInput("local-parallel");
      expect(handlers.setExecutionType).toHaveBeenCalledWith("local-parallel");
    });

    test("should set execution type to local when input is not recognized", async () => {
      await handleExecutionTypeInput("invalid-input");
      expect(handlers.setExecutionType).toHaveBeenCalledWith("local");
    });
  });
});
