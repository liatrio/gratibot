const sinon = require("sinon");
const expect = require("chai").expect;
const config = require("../../config");
const goldenRecognitionCollection = require("../../database/goldenRecognitionCollection");
const messageutils = require("../../service/messageutils");
const balance = require("../../service/balance");
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

  // FIX: This test is failing due to the following:
  // Error: Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves.

  // describe("sendNotificationToReceivers", () => {
  //   it('should send notifications to all receivers', async () => {
  //     const testClient = {
  //       chat: {
  //         postMessage: sinon.stub().resolves({}),
  //       },
  //     };
  //     const testGratitude = {
  //       receivers: [
  //         {
  //           id: "testuser1",
  //         },
  //         {
  //           id: "testuser2",
  //         },
  //       ],
  //     };

  //     sinon.stub(messageutils, "receiverSlackNotification").resolves({}); // Stub the receiverSlackNotification function
  //     sinon.stub(messageutils, "sendNotificationToReceivers").resolves({}); // Stub the sendNotificationToReceivers function
  //     const receiverMessageStub = sinon.stub().returns('test');
  //     sinon.stub(messageutils, 'getRecieverMessage').callsFake(receiverMessageStub);
  //     await messageutils.sendNotificationToReceivers(testClient, testGratitude);
  //     // Checks that the function passed to it was called twice (specifically 'testClient.chat.postMessage')
  //     // This means sendNotificationToReceivers sent a message to each of the two receivers in the test.
  //     expect(testClient.chat.postMessage.calledTwice).to.be.true;
  //     expect(testClient.chat.postMessage.getCall(0).args[0]).to.deep.equal({
  //       channel: testGratitude.receivers[0].id,
  //       text: "You earned a :fistbump:.",
  //       test: "test",
  //     });
  //     expect(testClient.chat.postMessage.getCall(1).args[0]).to.deep.equal({
  //       channel: testGratitude.receivers[1].id,
  //       text: "You earned a :fistbump:.",
  //       test: "test",
  //     });
  //   });
  // });

  describe("getRecieverMessage", () => {
    it("should get golden fistbump message", () => {
      const testGratitude = {
        type: goldenRecognizeEmoji,
      };
      const actualReceiverMessage =
        messageutils.getRecieverMessage(testGratitude);
      expect(actualReceiverMessage).to.eq(
        `You earned a ${goldenRecognizeEmoji}!!!`
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
  describe("doesUserHoldGoldenRecognition", () => {
    it("should return true if user holds the golden fistbump ", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const userHoldsGoldenRecognition =
        await messageutils.doesUserHoldGoldenRecognition(
          "Receiver",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.true;
    });

    it("should return false if user doesn't hold the golden fistbump ", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const userHoldsGoldenRecognition =
        await messageutils.doesUserHoldGoldenRecognition(
          "Receiver2",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.false;
    });

    it("should return false if golden recognition doesn't exist", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves(null);
      sinon.stub(goldenRecognitionCollection, "insert").resolves({});
      const userHoldsGoldenRecognition =
        await messageutils.doesUserHoldGoldenRecognition(
          "Receiver",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.false;
    });
  });

  describe("handleGoldenGratitudeErrors", () => {
    it("should return empty if gratitude is okay", async () => {
      sinon.stub(messageutils, "doesUserHoldGoldenRecognition").resolves(true);
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "test",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await messageutils.handleGoldenGratitudeErrors(gratitude);
      expect(result).to.deep.equal([]);
    });

    it("should return error if giver does not have golden fistbump", async () => {
      sinon.stub(messageutils, "doesUserHoldGoldenRecognition").resolves(false);
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "test2",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await messageutils.handleGoldenGratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- Only the current holder of the golden fistbump can give the golden fistbump",
      ]);
    });
  });

  describe("composeReceiverNotificationText", () => {
    it("normal fistbump message", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
        type: ":fistbump:",
      };

      const message = await messageutils.composeReceiverNotificationText(
        gratitude,
        "TestUser",
        10
      );
      expect(message).to.equal(
        "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `10`\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });

    it("golden fistbump given", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
        type: ":goldenfistbump:",
      };

      const message = await messageutils.composeReceiverNotificationText(
        gratitude,
        "TestUser",
        10
      );
      expect(message).to.equal(
        "Congratulations, You just got the :goldenfistbump: from <@Giver> in <#TestChannel>, and are now the holder of the Golden Fistbump! You earned `1` and your new balance is `10`. While you hold the Golden Fistbump you will receive a 2X multiplier on all fistbumps received!\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });

    it("fistbump given to golden fistbump holder", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "test",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
        type: ":fistbump:",
      };

      const message = await messageutils.composeReceiverNotificationText(
        gratitude,
        "test",
        10
      );
      expect(message).to.equal(
        "You just got a :fistbump: from <@Giver> in <#TestChannel>. With :goldenfistbump::goldenfistbump::goldenfistbump::goldenfistbump: multiplier you earned `2` and your new balance is `10`\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });
  });
  describe("receiverSlackNotification", () => {
    it("should generate a markdown response for recognition", async () => {
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "currentBalance").resolves(5);
      sinon
        .stub(messageutils, "composeReceiverNotificationText")
        .resolves(
          "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `5`\n>>>Test Message"
        );
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "GiverX",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "ReceiverX",
          },
        ],
        count: 1,
        channel: "TestChannel",
        message: "Test Message",
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You just got a :fistbump: from <@GiverX> in <#TestChannel>. You earned `1` and your new balance is `5`\n>>>Test Message",
            },
          },
        ],
      };

      const response = await messageutils.receiverSlackNotification(
        gratitude,
        "ReceiverX"
      );

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should include additional message for first time earners", async () => {
      sinon.stub(balance, "lifetimeEarnings").resolves(1);
      sinon.stub(balance, "currentBalance").resolves(1);
      sinon
        .stub(messageutils, "composeReceiverNotificationText")
        .resolves(
          "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `1`\n>>>Test Message"
        );
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "GiverX",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "ReceiverX",
          },
        ],
        count: 1,
        channel: "TestChannel",
        message: "Test Message",
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You just got a :fistbump: from <@GiverX> in <#TestChannel>. You earned `1` and your new balance is `1`\n>>>Test Message",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "I noticed this is your first time receiving a :fistbump:. Use `<@gratibot> redeem` to see what you can redeem :fistbump: for, or try running `<@gratibot> help` for more information about me.",
            },
          },
        ],
      };

      const response = await messageutils.receiverSlackNotification(
        gratitude,
        "ReceiverX"
      );

      expect(response).to.deep.equal(expectedResponse);
    });
  });
});
