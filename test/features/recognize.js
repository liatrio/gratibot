const sinon = require("sinon");
const suppressLogs = require("mocha-suppress-logs");
const expect = require("chai").expect;
const rewire = require("rewire");

const MockController = require("../mocks/controller");

const recognizeFeature = rewire("../../features/recognize");

describe("features/recognize", () => {

  describe("#checkForRecognitionErrors()", () => {
    it("should return an empty array when there are no errors", async () => {
      const messageText = ":fistbump: <@AAA1A1AA1> Test Test Test Test Test";
      const userInfo = {
        giver: {
          id: "BBB2B2BB2",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [{
          id: "AAA1A1AA1",
          is_bot: false,
          is_restricted:false,
        }],
      };
      const revert = recognizeFeature.__set__("isRecognitionWithinSpendingLimits", () => true);
      const result = await recognizeFeature.__get__("checkForRecognitionErrors")(messageText, userInfo);
      revert()
      expect(result).to.equal("");

    });
  });
});
