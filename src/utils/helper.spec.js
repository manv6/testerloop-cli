const fse = require("fs-extra");
const fs = require("fs");
const assert = require("assert");
const {
  getTestPerState,
  getTestStatesPerId,
  getTestResultsFromAllFilesOnlyOnce,
  getFilesSortedByMostRecent,
  createFailedLinks,
  extractTags,
  checkIfContainsTag,
  getNonCommonElements,
  checkIfAllWiped,
  readConfigurationFIle,
} = require("./helper");
const path = require("path");

describe.skip("helper", () => {
  describe("getTestPerState", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest
        .spyOn(fse, "readdir")
        .mockResolvedValue([
          "testResults-1686931021.json",
          "testResults-1686931876.json",
        ]);
      jest.spyOn(fse, "readJSON");
    });

    test("returns an array of filtered test data", async () => {
      fse.readJSON.mockResolvedValueOnce([
        { testId: 1, status: "passed" },
        { testId: 2, status: "failed" },
        { testId: 3, status: "passed" },
      ]);
      fse.readJSON.mockResolvedValueOnce([
        { id: 4, status: "passed" },
        { id: 5, status: "skipped" },
      ]);

      const result = await getTestPerState(
        "/tests/mocks/testFiles",
        "testResults-",
        "failed"
      );

      expect(fse.readdir).toHaveBeenCalledWith("/tests/mocks/testFiles");
      expect(fse.readJSON).toHaveBeenNthCalledWith(
        1,
        "/tests/mocks/testFiles/testResults-1686931021.json"
      );
      expect(fse.readJSON).toHaveBeenNthCalledWith(
        2,
        "/tests/mocks/testFiles/testResults-1686931876.json"
      );
      expect(result).toEqual([{ testId: 2, status: "failed" }]);
    });

    test("returns an empty array when no files match the prefix", async () => {
      fse.readJSON.mockResolvedValue([]);

      const result = await getTestPerState(
        "/tests/mocks/testFiles",
        "testResults-",
        "failed"
      );

      expect(fse.readdir).toHaveBeenCalledWith("/tests/mocks/testFiles");
      expect(result).toEqual([]);
    });

    test("returns an empty array and logs an error when readdir throws an error", async () => {
      const error = new Error("Error reading directory");
      jest.spyOn(console, "log");
      fse.readdir.mockRejectedValueOnce(error);

      const result = await getTestPerState(
        "/tests/mocks/testFiles",
        "test",
        "passed"
      );

      expect(fse.readdir).toHaveBeenCalledWith("/tests/mocks/testFiles");
      expect(console.log).toHaveBeenCalledWith(
        "!! No result files found for this execution. Check your s3 or reporter setup"
      );
      expect(result).toEqual([]);
    });
  });

  describe("getTestStatesPerId", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("returns an empty array when no result files are found", async () => {
      const directory = "/tests/mocks/testFiles/";
      const filePrefix = "testResults-";
      const listOfTestsToCheck = [
        {
          testId: "307f8963-a118-4536-b43f-66437d9fbbd1",
          title: "Home Page - Enter different emails Example 1",
          titlePath: [
            "Check overloop's website",
            "Home Page - Enter different emails Example 1",
          ],
          status: "failed",
          pathToTest:
            "cypress/e2e/parsed/overloop/Check_overloop's_website_Home_Page__Enter_different_emails_1.feature",
          startedTestsAt: "2023-06-15T13:52:57.005Z",
          endedTestsAt: "2023-06-15T13:53:10.404Z",
        },
        {
          testId: "3f002005-e084-4895-a58d-00ea6f6d01e8",
          title: "Home Page - Enter different emails Example 2",
          titlePath: [
            "Check overloop's website",
            "Home Page - Enter different emails Example 2",
          ],
          status: "failed",
          pathToTest:
            "cypress/e2e/parsed/overloop/Check_overloop's_website_Home_Page__Enter_different_emails_2.feature",
          startedTestsAt: "2023-06-15T13:52:53.232Z",
          endedTestsAt: "2023-06-15T13:53:07.295Z",
        },
        {
          testId: "c2e4893e-1c6d-4aff-914a-bbac058cb0a5",
          title: "Home Page Pass",
          titlePath: ["Check overloop's website", "Home Page Pass"],
          status: "passed",
          pathToTest:
            "cypress/e2e/parsed/overloop/Check_overloop's_website_Home_Page_Pass.feature",
          startedTestsAt: "2023-06-15T13:52:53.620Z",
          endedTestsAt: "2023-06-15T13:53:02.044Z",
        },
      ];

      jest.spyOn(fse, "readdir").mockResolvedValue([]);

      const result = await getTestStatesPerId(
        directory,
        filePrefix,
        listOfTestsToCheck
      );

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(result).toEqual([]);
    });

    test("returns an empty array when no matching files are found", async () => {
      const directory = "/mock/directory";
      const filePrefix = "mockPrefix";
      const listOfTestsToCheck = [1, 2, 3];
      const files = ["file1.json", "file2.json", "file3.txt"];

      // Mocking the readdir function to return the list of files
      fse.readdir.mockResolvedValue(files);

      const result = await getTestStatesPerId(
        directory,
        filePrefix,
        listOfTestsToCheck
      );

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(result).toEqual([]);
    });

    test("returns the filtered data when matching files and test IDs are found", async () => {
      const directory = "/mock/directory";
      const filePrefix = "mockPrefix";
      const listOfTestsToCheck = ["1", "4", "3", "6"];
      const files = ["mockPrefix1.json", "mockPrefix2.json"];
      const jsonData1 = [
        { testId: "1", data: "test1" },
        { testId: "2", data: "test2" },
        { testId: "3", data: "test3" },
      ];
      const jsonData2 = [
        { testId: "4", data: "test4" },
        { testId: "5", data: "test5" },
        { testId: "6", data: "test6" },
        { testId: "7", data: "test7" },
      ];

      // Mocking the readdir function to return the list of files
      fse.readdir.mockResolvedValue(files);

      // Mocking the readJSON function with custom implementation
      fse.readJSON.mockImplementation(async (filePath) => {
        if (filePath.endsWith("1.json")) {
          return jsonData1;
        } else if (filePath.endsWith("2.json")) {
          return jsonData2;
        }
        throw new Error(`Unexpected file path: ${filePath}`);
      });

      jest
        .spyOn(path, "join")
        .mockImplementation((dir, file) => `${dir}/${file}`);

      const test = await getTestStatesPerId(
        directory,
        filePrefix,
        listOfTestsToCheck
      );

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(fse.readJSON).toHaveBeenCalledWith(
        path.join(directory, "mockPrefix1.json")
      );
      expect(fse.readJSON).toHaveBeenCalledWith(
        path.join(directory, "mockPrefix2.json")
      );

      expect(test).toEqual([
        { testId: "1", data: "test1" },
        { testId: "3", data: "test3" },
        { testId: "4", data: "test4" },
        { testId: "6", data: "test6" },
      ]);
    });
  });

  describe("getTestResultsFromAllFilesOnlyOnce", () => {
    beforeEach(() => {
      // jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    test("should return an array of unique test results from all files", async () => {
      const directory = "path/to/directory";
      const filePrefix = "prefix-";

      const files = [
        "prefix-1631977200000.json",
        "prefix-1631977200054.json",
        "other-1631977200945.json",
      ];
      const json1 = [{ testId: "1" }, { testId: "2", data: "included" }];
      const json2 = [{ testId: "2", data: "excluded" }, { testId: "3" }];

      jest
        .spyOn(fse, "readJSON")
        .mockResolvedValueOnce(json1)
        .mockResolvedValueOnce(json2);
      jest.spyOn(fse, "readdir").mockResolvedValue(files);

      const result = await getTestResultsFromAllFilesOnlyOnce(
        directory,
        filePrefix
      );

      expect(result).toEqual([
        { testId: "1" },
        { testId: "2", data: "included" },
        { testId: "3" },
      ]);

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(fse.readJSON).toHaveBeenCalledTimes(2);
      expect(fse.readJSON).toHaveBeenCalledWith(
        path.join(directory, "prefix-1631977200000.json")
      );
      expect(fse.readJSON).toHaveBeenCalledWith(
        path.join(directory, "prefix-1631977200054.json")
      );
    });

    test("should handle no result files found", async () => {
      const directory = "path/to/directory";
      const filePrefix = "prefix-";

      jest.spyOn(fse, "readdir").mockResolvedValue([]);

      const result = await getTestResultsFromAllFilesOnlyOnce(
        directory,
        filePrefix
      );

      expect(result).toEqual([]);
    });
  });

  describe("getFilesSortedByMostRecent", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("returns an empty array when no files are found", async () => {
      const directory = "/mock/directory";
      const filePrefix = "mockPrefix-";

      // Mocking the readdir function to return an empty array
      fse.readdir.mockResolvedValue([]);

      const result = await getFilesSortedByMostRecent(directory, filePrefix);

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(result).toEqual([]);
    });

    test("returns sorted file names when files are found", async () => {
      const directory = "/mock/directory";
      const filePrefix = "mockPrefix-";
      const files = [
        "mockPrefix-1631977200000.json",
        "mockPrefix-1631900400000.json",
        "mockPrefix-1632011600000.json",
      ];

      // Mocking the readdir function to return the list of files
      fse.readdir.mockResolvedValue(files);

      const result = await getFilesSortedByMostRecent(directory, filePrefix);

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(result).toEqual([
        "mockPrefix-1632011600000.json",
        "mockPrefix-1631977200000.json",
        "mockPrefix-1631900400000.json",
      ]);
    });

    test("returns sorted file names without non-matching files", async () => {
      const directory = "/mock/directory";
      const filePrefix = "mockPrefix-";
      const files = [
        "mockPrefix-1631977200000.json",
        "mockPrefix-1631900400000.json",
        "nonMatchingFile.txt",
        "mockPrefix-1632011600000.json",
      ];

      // Mocking the readdir function to return the list of files
      fse.readdir.mockResolvedValue(files);

      const result = await getFilesSortedByMostRecent(directory, filePrefix);

      expect(fse.readdir).toHaveBeenCalledWith(directory);
      expect(result).toEqual([
        "mockPrefix-1632011600000.json",
        "mockPrefix-1631977200000.json",
        "mockPrefix-1631900400000.json",
      ]);
    });
  });

  describe("createFailedLinks", () => {
    it("prints failed test links", async () => {
      const failedTests = [
        { testId: "test-1", title: "Test Title 1" },
        { testId: "test-2", title: "Test Title 2" },
      ];
      const orgURL = "https://org.testurl.com";
      // const runId = "1bda356a-06d9-4f6d-b5dc-cff7c664fb05";
      // @TODO refactor the setRunId to be outside the helpers function and mock it
      const runId = "undefined";

      console.log = jest.fn().mockResolvedValueOnce("Test");

      // const createFailedLinksMock = jest.fn().mockImplementation((failedTests) => {
      //   return failedTests.map(([testName, testLink]) => `${testName} ${testLink}`).join('\n');
      // });

      await createFailedLinks(failedTests, orgURL);

      // console.log(console.log);
      expect(console.log).toHaveBeenCalledWith(
        `Test failed: ${failedTests[0].title} `,
        `${orgURL}/run/${runId}/test/${failedTests[0].testId}`
      );
      expect(console.log).toHaveBeenCalledWith(
        `Test failed: ${failedTests[1].title} `,
        `${orgURL}/run/${runId}/test/${failedTests[1].testId}`
      );
    });
  });

  describe("extractTags", () => {
    test("extractTags function should return an array of tags when input contains tags", () => {
      const inputString = "Hey, this is a post with @tag1 and @tag2";
      const expectedOutput = ["@tag1", "@tag2"];
      const actualOutput = extractTags(inputString);
      expect(actualOutput).toEqual(expectedOutput);
    });
  });

  describe("checkIfContainsTag", () => {
    test("returns true if file contains the given tag with whitespace around it", () => {
      const filename = "test-file.txt";
      const str = "@test";
      const contents = "This file contains an @test tag.";
      jest.spyOn(fs, "readFileSync").mockReturnValue(contents);
      expect(checkIfContainsTag(filename, str)).toBeTruthy();
      expect(fs.readFileSync).toHaveBeenCalledWith(filename, "utf-8");
    });

    test("returns false if file does not contain the given tag with whitespace around it", () => {
      const filename = "test-file.txt";
      const str = "example";
      const contents = "This file does not contain the tag we are looking for.";
      jest.spyOn(fs, "readFileSync").mockReturnValue(contents);
      expect(checkIfContainsTag(filename, str)).toBeFalsy();
      expect(fs.readFileSync).toHaveBeenCalledWith(filename, "utf-8");
    });
  });

  describe("getNonCommonElements", () => {
    it("should return an array of non-common elements between two arrays", () => {
      const arr1 = [1, 2, 3, 4];
      const arr2 = [3, 4, 5, 6];
      const result = getNonCommonElements(arr1, arr2);
      expect(result).toEqual([1, 2, 5, 6]);
    });

    it("should return an empty array if there are no non-common elements", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const result = getNonCommonElements(arr1, arr2);
      expect(result).toEqual([]);
    });

    it("should return an array with elements in the same order as they appear in the input arrays", () => {
      const arr1 = [1, 2, 3, 4];
      const arr2 = [3, 2, 4, 1];
      const result = getNonCommonElements(arr1, arr2);
      expect(result).toEqual([]);
    });

    it("should work with arrays of strings", () => {
      const arr1 = ["apple", "banana", "orange"];
      const arr2 = ["banana", "kiwi", "grape"];
      const result = getNonCommonElements(arr1, arr2);
      expect(result).toEqual(["apple", "orange", "kiwi", "grape"]);
    });
  });

  describe("checkIfAllWiped", () => {
    it("should return true if not all scenarios are tagged", () => {
      const content = `Feature: Example feature
        Scenario: Scenario 1
          Given ...
          
        Scenario Outline: Scenario 2
          Given ...
          Examples:
          | example |
          | value   |
      `;
      fs.writeFileSync("temp.feature", content);

      // the tag `@wiped` is not present in any Scenario or Scenario Outline
      const result = checkIfAllWiped("temp.feature", "@wiped");
      expect(result).toEqual(true);

      fs.unlinkSync("temp.feature");
    });

    it("should return false if all scenarios are tagged", () => {
      const content = `Feature: Example feature
        @wiped
        Scenario: Scenario 1
          Given ...
          
        @wiped
        Scenario Outline: Scenario 2
          Given ...
          Examples:
          | example |
          | value   |
      `;
      fs.writeFileSync("temp.feature", content);

      // all scenarios are tagged `@wiped`
      const result = checkIfAllWiped("temp.feature", "@wiped");
      expect(result).toEqual(false);

      fs.unlinkSync("temp.feature");
    });

    it("should return false if only one untagged scenario exists", () => {
      const content = `Feature: Example feature
        @wiped
        Scenario: Scenario 1
          Given ...
          
        @wiped
        Scenario Outline: Scenario 2
          Given ...
          Examples:
          | example |
          | value   |
          
        Scenario: Scenario 3
          Given ...
      `;
      fs.writeFileSync("temp.feature", content);

      // only one untagged scenario exists
      const result = checkIfAllWiped("temp.feature", "@wiped");
      expect(result).toEqual(false);

      fs.unlinkSync("temp.feature");
    });
  });

  describe("readConfigurationFile", function() {
    it("should read and parse a JSON file", async function() {
      const expected = { key: "value" };
      const fileName = "config.json";

      fs.writeFileSync(fileName, JSON.stringify(expected));

      const actual = await readConfigurationFIle(fileName);

      assert.deepStrictEqual(actual, expected);
    });

    it("should reject with an error if the file cannot be read", async function() {
      const fileName = "non-existent-file.json";

      await assert.rejects(async () => await readConfigurationFIle(fileName), {
        name: "Error",
        message: `Error reading ${fileName} file 1: Error: ENOENT: no such file or directory`,
      });
    });
  });
});
