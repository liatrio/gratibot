const sinon = require("sinon");
const expect = require("chai").expect;

const recognizeFeature = require("../../features/recognize");
const recognition = require("../../service/recognition");
const config = require("../../config");
const { GratitudeError, SlackError } = require("../../service/errors");
const { createMockApp } = require("../mocks/bolt-app");

// Helper: build a fake Slack client with just the pieces the recognize
// feature touches.
function mockClient(userInfoByUserId) {
  return {
    users: {
      info: sinon.stub().callsFake(async ({ user }) => ({
        ok: true,
        user: userInfoByUserId[user],
      })),
    },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
    reactions: {
      add: sinon.stub().resolves(),
    },
  };
}

describe("features/recognize", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToRecognitionMessage", () => {
    it("should assemble the gratitude object and react to the message on the happy path", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const messageHandler = findHandler("message", config.recognizeEmoji);

      sinon.stub(recognition, "validateAndSendGratitude").resolves();
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves({ blocks: [] });
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves({ blocks: [] });

      const client = mockClient({
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        Ureceiver: {
          id: "Ureceiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      });
      const message = {
        user: "Ugiver",
        text: "thanks <@Ureceiver> for your great help :fistbump:",
        channel: "Cchannel",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      expect(recognition.validateAndSendGratitude.calledOnce).to.equal(true);
      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver.id).to.equal("Ugiver");
      expect(gratitude.receivers.map((r) => r.id)).to.deep.equal(["Ureceiver"]);
      expect(gratitude.giver_in_receivers).to.equal(false);
      expect(gratitude.channel).to.equal("Cchannel");
      expect(gratitude.type).to.equal(":fistbump:");

      expect(client.reactions.add.calledOnce).to.equal(true);
      const reactionArgs = client.reactions.add.firstCall.args[0];
      expect(reactionArgs.channel).to.equal("Cchannel");
      expect(reactionArgs.timestamp).to.equal("1700000000.000100");
    });

    it("should flag giver_in_receivers when the giver also appears in the receiver list", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const messageHandler = findHandler("message", config.recognizeEmoji);

      sinon.stub(recognition, "validateAndSendGratitude").resolves();
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves({ blocks: [] });
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves({ blocks: [] });

      const client = mockClient({
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      });
      const message = {
        user: "Ugiver",
        text: "thanks <@Ugiver> for the self-assist :fistbump:",
        channel: "Cchannel",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver_in_receivers).to.equal(true);
    });

    it("should route SlackError through handleSlackError and not react to the message", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const messageHandler = findHandler("message", config.recognizeEmoji);

      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(
          new SlackError(
            "users.info",
            "user_not_found",
            "slack-error-user-message",
          ),
        );

      const client = mockClient({
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        Ureceiver: {
          id: "Ureceiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      });
      const message = {
        user: "Ugiver",
        text: "thanks <@Ureceiver> :fistbump:",
        channel: "Cchannel",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      expect(client.reactions.add.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.equal(
        "slack-error-user-message",
      );
    });

    it("should route a plain Error through handleGenericError", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const messageHandler = findHandler("message", config.recognizeEmoji);

      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new Error("unexpected-boom"));

      const client = mockClient({
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        Ureceiver: {
          id: "Ureceiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      });
      const message = {
        user: "Ugiver",
        text: "thanks <@Ureceiver> :fistbump:",
        channel: "Cchannel",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      expect(client.reactions.add.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const text = client.chat.postEphemeral.firstCall.args[0].text;
      expect(text).to.include("An unknown error occured in Gratibot");
      expect(text).to.include("unexpected-boom");
    });

    it("should route GratitudeError through handleGratitudeError and not react to the message", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const messageHandler = findHandler("message", config.recognizeEmoji);

      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new GratitudeError(["- You can't recognize yourself"]));

      const client = mockClient({
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        Ureceiver: {
          id: "Ureceiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      });
      const message = {
        user: "Ugiver",
        text: "thanks <@Ureceiver> :fistbump:",
        channel: "Cchannel",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      expect(client.reactions.add.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const args = client.chat.postEphemeral.firstCall.args[0];
      expect(args.text).to.include("Sending gratitude failed");
      expect(args.text).to.include("- You can't recognize yourself");
    });
  });

  describe("respondToRecognitionReaction", () => {
    function reactionClient({
      replyMessage = "thanks <@Ureceiver> :fistbump:",
      repliesOk = true,
      usersById = {
        Ugiver: {
          id: "Ugiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        Ureceiver: {
          id: "Ureceiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      },
    } = {}) {
      return {
        users: {
          info: sinon.stub().callsFake(async ({ user }) => ({
            ok: true,
            user: usersById[user],
          })),
        },
        conversations: {
          replies: sinon.stub().resolves(
            repliesOk
              ? { ok: true, messages: [{ text: replyMessage }] }
              : {
                  ok: false,
                  error: "not_in_channel",
                  message: "bot not in channel",
                },
          ),
        },
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
        reactions: { add: sinon.stub().resolves() },
      };
    }

    function reactionEvent({ reactorUserId = "Ugiver" } = {}) {
      return {
        user: reactorUserId,
        reaction: "nail_care",
        item: { channel: "Cchannel", ts: "1700000000.000100" },
      };
    }

    it("should validate and respond to the giver when the reacted message contains :fistbump:", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const reactionHandler = findHandler("event", "reaction_added");

      sinon.stub(recognition, "validateAndSendGratitude").resolves();
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves({ blocks: [] });
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves({ blocks: [] });

      const client = reactionClient();
      const event = reactionEvent();

      await reactionHandler({ event, client });

      expect(recognition.validateAndSendGratitude.calledOnce).to.equal(true);
      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver.id).to.equal("Ugiver");
      expect(gratitude.receivers.map((r) => r.id)).to.deep.equal(["Ureceiver"]);
      expect(gratitude.count).to.equal(1);
      expect(gratitude.channel).to.equal("Cchannel");

      // sendNotificationToReceivers + respondToUser — the reaction handler does
      // not call client.reactions.add.
      expect(client.chat.postMessage.called).to.equal(true);
      expect(client.reactions.add.called).to.equal(false);
    });

    it("should short-circuit when the reacted message does not contain the recognize emoji", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const reactionHandler = findHandler("event", "reaction_added");

      const validateStub = sinon.stub(recognition, "validateAndSendGratitude");

      const client = reactionClient({ replyMessage: "no emoji here" });
      const event = reactionEvent();

      await reactionHandler({ event, client });

      expect(validateStub.called).to.equal(false);
      expect(client.chat.postMessage.called).to.equal(false);
      expect(client.chat.postEphemeral.called).to.equal(false);
    });

    it("should dispatch handleSlackError when conversations.replies responds with ok:false", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const reactionHandler = findHandler("event", "reaction_added");

      const validateStub = sinon.stub(recognition, "validateAndSendGratitude");

      const client = reactionClient({ repliesOk: false });
      const event = reactionEvent();

      await reactionHandler({ event, client });

      expect(validateStub.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.include(
        "Something went wrong while sending recognition",
      );
    });

    it("should set giver_in_receivers when the reactor is also a receiver", async () => {
      const { app, findHandler } = createMockApp();
      recognizeFeature(app);
      const reactionHandler = findHandler("event", "reaction_added");

      sinon.stub(recognition, "validateAndSendGratitude").resolves();
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves({ blocks: [] });
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves({ blocks: [] });

      const client = reactionClient({
        replyMessage: "thanks <@Ugiver> :fistbump:",
      });
      const event = reactionEvent();

      await reactionHandler({ event, client });

      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver_in_receivers).to.equal(true);
    });
  });
});
