const sinon = require("sinon");
const expect = require("chai").expect;
const config = require("../../config");
const recognition = require("../../service/recognition");
const messageutils = require("../../service/messageutils");
const { goldenRecognizeEmoji, recognizeEmoji } = config;

describe("service/messageutils", () => {
  afterEach(() => {
    sinon.restore();
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
        testError,
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

  describe("sendNotificationToReceivers", () => {
    it("should send a message to each receiver", () => {
      const testClient = {
        chat: {
          postMessage: sinon.stub(),
        },
      };
      const testGratitude = {
        receivers: [
          {
            id: "testuser1",
          },
          {
            id: "testuser2",
          },
        ],
      };
      sinon
        .stub(recognition, "receiverSlackNotification")
        .returns({ test: "test" });
      return expect(
        messageutils.sendNotificationToReceivers(testClient, testGratitude),
      ).to.eventually.be.fulfilled.then(() => {
        // Checks that the function passed to it was called twice (specifically 'testClient.chat.postMessage')
        // This means sendNotificationToReceivers sent a message to each of the two receivers in the test.
        sinon.assert.calledTwice(testClient.chat.postMessage);
        sinon.assert.calledWith(testClient.chat.postMessage, {
          channel: testGratitude.receivers[0].id,
          text: "You earned a :fistbump:.",
          test: "test",
        });
        sinon.assert.calledWith(testClient.chat.postMessage, {
          channel: testGratitude.receivers[1].id,
          text: "You earned a :fistbump:.",
          test: "test",
        });
      });
    });
  });

  describe("getRecieverMessage", () => {
    it("should get golden fistbump message", () => {
      const testGratitude = {
        type: goldenRecognizeEmoji,
      };
      const actualReceiverMessage =
        messageutils.getRecieverMessage(testGratitude);
      expect(actualReceiverMessage).to.eq(
        `You earned a ${goldenRecognizeEmoji}!!!`,
      );
    });
    it("should get fistbump message", () => {
      const testGratitude = {
        type: recognizeEmoji,
      };
      const actualReceiverMessage =
        messageutils.getRecieverMessage(testGratitude);
      expect(actualReceiverMessage).to.eq(`You earned a ${recognizeEmoji}.`);
    });
  });
});
