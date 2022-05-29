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

  describe("handleSlackError", async () => {
    it("should return the proper message", async () => {
      const testClient = {
        chat: {
          postEphemeral: sinon.stub(),
        },
      };
      const testMessage = {
        channel: "testchannel",
        user: "testuser",
      };
      const testError = {
        userMessage: "test error",
        gratitudeErrors: ["error1", "error2"],
      };
      await messageutils.handleSlackError(testClient, testMessage, testError);
      sinon.assert.calledWith(testClient.chat.postEphemeral, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: testError.userMessage,
      });
    });
  });

  describe("handleGratitudeError", async () => {
    it("should return the proper message", async () => {
      const testClient = {
        chat: {
          postEphemeral: sinon.stub(),
        },
      };
      const testMessage = {
        channel: "testchannel",
        user: "testuser",
      };
      const testError = {
        userMessage: "test error",
        gratitudeErrors: ["error1", "error2"],
      };
      await messageutils.handleGratitudeError(
        testClient,
        testMessage,
        testError
      );
      sinon.assert.calledWith(testClient.chat.postEphemeral, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "Sending gratitude failed with the following error(s):\nerror1\nerror2",
      });
    });
  });

  describe("handleGenericError", async () => {
    it("should return the proper message", async () => {
      const testClient = {
        chat: {
          postEphemeral: sinon.stub(),
        },
      };
      const testMessage = {
        channel: "testchannel",
        user: "testuser",
      };
      const testError = {
        message: "test error",
        gratitudeErrors: ["error1", "error2"],
      };
      await messageutils.handleGenericError(testClient, testMessage, testError);
      sinon.assert.calledWith(testClient.chat.postEphemeral, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "An unknown error occured in Gratibot: test error",
      });
    });
  });
});
