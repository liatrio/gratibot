const sinon = require("sinon");
const expect = require("chai").expect;

const golden_recognition = require("../../service/golden-recognition");
const goldenRecognitionCollection = require("../../database/goldenRecognitionCollection");

describe("service/golden-recognition", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getGoldenFistbumpHolder", () => {
    it("should return relevant info about the golden fistbump holder", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });

      const goldenFistbumpInfo =
        await golden_recognition.getGoldenFistbumpHolder();

      const object = {
        goldenFistbumpHolder: "Receiver",
        message: "Test Message",
        timestamp: new Date(2020, 1, 1),
      };

      expect(goldenFistbumpInfo).to.deep.equal(object);
    });
  });
  describe("giverGoldenSlackNotification", () => {
    it("default path for golden fistbump", async () => {
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "Receiver",
          },
        ],
        count: 1,
        type: ":goldenfistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You have handed off the :goldenfistbump:. Thanks for sharing the wealth!",
            },
          },
        ],
      };

      const response = await golden_recognition.giverGoldenSlackNotification(
        gratitude
      );

      expect(response).to.deep.equal(expectedResponse);
    });
  });
});
