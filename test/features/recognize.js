const expect = require("chai").expect;
const sinon = require("sinon");
const config = require("../../config");
const { recognizeEmoji, shareChannel, shareConfirmReaction, reactionEmoji } =
  config;

const { SlackError, GratitudeError } = require("../../service/errors");

describe("features/recognize", () => {
  let app;
  let recognition;
  let messageUtils;
  let userInfo;
  let shareReactionCollection;
  let winston;

  beforeEach(() => {
    app = {
      message: (pattern, handler) => {
        app.messageHandler = handler;
      },
      event: (pattern, handler) => {
        app.eventHandler = handler;
      },
    };

    recognition = {
      gratitudeReceiverIdsIn: sinon.stub().resolves(["USER456"]),
      validateAndSendGratitude: sinon.stub().resolves(),
      gratitudeCountIn: sinon.stub().returns(1),
      trimmedGratitudeMessage: sinon.stub().returns("Great work!"),
      gratitudeTagsIn: sinon.stub().returns([]),
      giverSlackNotification: sinon.stub().resolves({}),
    };

    messageUtils = {
      handleSlackError: sinon.stub().resolves(),
      handleGratitudeError: sinon.stub().resolves(),
      handleGenericError: sinon.stub().resolves(),
      sendNotificationToReceivers: sinon.stub().resolves(),
    };

    userInfo = sinon.stub().resolves({
      ok: true,
      user: {
        id: "USER123",
        real_name: "Test User",
        name: "testuser",
        tz: "America/Chicago",
      },
    });

    shareReactionCollection = {
      findOne: sinon.stub().resolves(null),
      insert: sinon.stub().resolves(),
    };

    winston = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
    };

    require("proxyquire").noCallThru()("../../features/recognize", {
      "../service/recognition": recognition,
      "../service/messageutils": messageUtils,
      "../service/apiwrappers": { userInfo },
      "../database/shareReactionCollection": shareReactionCollection,
      "../winston": winston,
      "../config": config,
    })(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Message Recognition", () => {
    it("should process valid recognition message", async () => {
      const postEphemeralStub = sinon.stub().resolves({ ok: true });
      const addReactionStub = sinon.stub().resolves({ ok: true });

      const client = {
        chat: {
          postEphemeral: postEphemeralStub,
          postMessage: sinon.stub().resolves({ ok: true }),
        },
        reactions: {
          add: addReactionStub,
        },
      };

      const message = {
        user: "USER123",
        channel: "CHANNEL123",
        text: ":fistbump: <@USER456> Great work!",
        ts: "1234567890.123",
      };

      await app.messageHandler({ message, client });

      expect(recognition.gratitudeReceiverIdsIn.calledOnce).to.be.true;
      expect(recognition.validateAndSendGratitude.calledOnce).to.be.true;
      expect(postEphemeralStub.calledOnce).to.be.true;
      expect(addReactionStub.calledOnce).to.be.true;

      expect(postEphemeralStub.firstCall.args[0]).to.deep.include({
        channel: message.channel,
        user: message.user,
        text: `${recognizeEmoji} has been sent.`,
      });

      expect(addReactionStub.firstCall.args[0]).to.deep.include({
        channel: message.channel,
        name: config.reactionEmoji.slice(1, -1),
        timestamp: message.ts,
      });
    });

    it("should handle SlackError", async () => {
      const client = {
        chat: { postEphemeral: sinon.stub().resolves({ ok: true }) },
      };

      const message = {
        user: "USER123",
        channel: "CHANNEL123",
        text: ":fistbump: <@USER456> Great work!",
      };

      recognition.gratitudeReceiverIdsIn.rejects(
        new SlackError("test", "error", "Slack Error"),
      );
      await app.messageHandler({ message, client });
      expect(messageUtils.handleSlackError.calledOnce).to.be.true;
    });

    it("should handle GratitudeError", async () => {
      const client = {
        chat: { postEphemeral: sinon.stub().resolves({ ok: true }) },
      };

      const message = {
        user: "USER123",
        channel: "CHANNEL123",
        text: ":fistbump: <@USER456> Great work!",
      };

      recognition.validateAndSendGratitude.rejects(
        new GratitudeError(["error"]),
      );
      await app.messageHandler({ message, client });
      expect(messageUtils.handleGratitudeError.calledOnce).to.be.true;
    });
  });

  describe("Reaction Events", () => {
    it("should handle share confirmation reaction", async () => {
      const postEphemeralStub = sinon.stub().resolves({ ok: true });
      const conversationsRepliesStub = sinon.stub().resolves({
        ok: true,
        messages: [{ text: "Test message" }],
      });

      const client = {
        chat: {
          postEphemeral: postEphemeralStub,
          postMessage: sinon.stub().resolves({ ok: true }),
        },
        users: {
          info: sinon.stub().resolves({
            ok: true,
            user: {
              id: "USER123",
              real_name: "Test User",
              name: "testuser",
              tz: "America/Chicago",
            },
          }),
        },
        conversations: {
          replies: conversationsRepliesStub,
        },
      };

      const event = {
        user: "USER123",
        item: {
          channel: shareChannel,
          ts: "1234567890.123",
        },
        reaction: shareConfirmReaction,
      };

      await app.eventHandler({ event, client });

      expect(shareReactionCollection.findOne.calledOnce).to.be.true;
      expect(shareReactionCollection.insert.calledOnce).to.be.true;
      expect(recognition.validateAndSendGratitude.calledOnce).to.be.true;
      expect(postEphemeralStub.calledOnce).to.be.true;
    });

    it("should handle recognition reaction", async () => {
      const postEphemeralStub = sinon.stub().resolves({ ok: true });
      const conversationsRepliesStub = sinon.stub().resolves({
        ok: true,
        messages: [{ text: `:fistbump: <@USER456> Great work!` }],
      });

      const client = {
        chat: {
          postEphemeral: postEphemeralStub,
          postMessage: sinon.stub().resolves({ ok: true }),
        },
        conversations: {
          replies: conversationsRepliesStub,
        },
      };

      const event = {
        user: "USER123",
        item: {
          channel: "CHANNEL123",
          ts: "1234567890.123",
        },
        reaction: reactionEmoji.slice(1, -1),
      };

      await app.eventHandler({ event, client });

      expect(recognition.gratitudeReceiverIdsIn.calledOnce).to.be.true;
      expect(recognition.validateAndSendGratitude.calledOnce).to.be.true;
      expect(postEphemeralStub.calledOnce).to.be.true;
    });

    it("should handle existing share reaction", async () => {
      const postEphemeralStub = sinon.stub().resolves({ ok: true });

      const client = {
        chat: {
          postEphemeral: postEphemeralStub,
        },
        users: {
          info: sinon.stub().resolves({
            ok: true,
            user: {
              id: "USER123",
              real_name: "Test User",
              name: "testuser",
              tz: "America/Chicago",
            },
          }),
        },
      };

      shareReactionCollection.findOne.resolves({ userId: "USER123" });

      const event = {
        user: "USER123",
        item: {
          channel: shareChannel,
          ts: "1234567890.123",
        },
        reaction: shareConfirmReaction,
      };

      await app.eventHandler({ event, client });

      expect(shareReactionCollection.findOne.calledOnce).to.be.true;
      expect(shareReactionCollection.insert.called).to.be.false;
      expect(postEphemeralStub.calledOnce).to.be.true;
      expect(postEphemeralStub.firstCall.args[0].text).to.include(
        "already confirmed",
      );
    });

    it("should handle error in user info", async () => {
      const client = {
        users: {
          info: sinon.stub().resolves({
            ok: false,
            error: "user_not_found",
          }),
        },
      };

      const event = {
        user: "USER123",
        item: {
          channel: shareChannel,
          ts: "1234567890.123",
        },
        reaction: shareConfirmReaction,
      };

      await app.eventHandler({ event, client });
      expect(messageUtils.handleSlackError.calledOnce).to.be.true;
    });
  });
});
