const sinon = require("sinon");
const expect = require("chai").expect;
const config = require("../../config");
const messageutils = require("../../service/messageutils");
const { goldenRecognizeEmoji, recognizeEmoji } = config;

describe("service/messageutils", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getRecieverMessage", () => {
    it("should get golden fistbump message", async () => {
      const testGratitude = {
        type: goldenRecognizeEmoji,
      };
      const actualReceiverMessage =
        messageutils.getRecieverMessage(testGratitude);
      expect(actualReceiverMessage).to.eq(
        `You earned a ${goldenRecognizeEmoji}!!!`
      );
    });
    it("should get fistbump message", async () => {
      const testGratitude = {
        type: recognizeEmoji,
      };
      const actualReceiverMessage =
        messageutils.getRecieverMessage(testGratitude);
      expect(actualReceiverMessage).to.eq(`You earned a ${recognizeEmoji}.`);
    });
  });
});
