const sinon = require("sinon");
const expect = require("chai").expect;

const goldenRecognizeFeature = require("../../features/golden-recognize");
const recognition = require("../../service/recognition");
const config = require("../../config");
const { SlackError, GratitudeError } = require("../../service/errors");
const { createMockApp } = require("../mocks/bolt-app");

function buildClient() {
  return {
    users: {
      info: sinon.stub().callsFake(async ({ user }) => ({
        ok: true,
        user: {
          id: user,
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      })),
    },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
  };
}

function stubRecognitionAssembly() {
  sinon.stub(recognition, "gratitudeReceiverIdsIn").resolves(["Ureceiver"]);
  sinon.stub(recognition, "trimmedGratitudeMessage").returns("congrats");
  sinon.stub(recognition, "gratitudeTagsIn").returns([]);
}

describe("features/golden-recognize", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToRecognitionMessage", () => {
    it("should validate, notify receivers, and announce to the golden channel on the happy path", async () => {
      stubRecognitionAssembly();
      sinon.stub(recognition, "validateAndSendGratitude").resolves();
      sinon
        .stub(recognition, "giverGoldenSlackNotification")
        .resolves({ blocks: [] });
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves({ blocks: [] });

      const { app, registrations } = createMockApp();
      goldenRecognizeFeature(app);
      const handler = registrations.message[0].handler;

      const client = buildClient();
      const message = {
        user: "Ugiver",
        text: "thanks <@Ureceiver> for leading the pack :goldenfistbump:",
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await handler({ message, client });

      expect(recognition.validateAndSendGratitude.calledOnce).to.equal(true);
      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.type).to.equal(":goldenfistbump:");
      expect(gratitude.receivers.map((r) => r.id)).to.deep.equal(["Ureceiver"]);

      // sendNotificationToReceivers + respondToUser (ephemeral for channel) +
      // postMessage to the golden channel.
      expect(client.chat.postMessage.callCount).to.equal(2);
      const channelPost = client.chat.postMessage
        .getCalls()
        .map((c) => c.args[0])
        .find((c) => c.channel === config.goldenRecognizeChannel);
      expect(channelPost).to.not.equal(undefined);
      expect(channelPost.text).to.include(
        "The :goldenfistbump: has been bestowed upon thy majesty <@Ureceiver>",
      );
    });

    it("should dispatch handleGratitudeError when validateAndSendGratitude rejects with GratitudeError", async () => {
      stubRecognitionAssembly();
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new GratitudeError(["- You can't recognize yourself"]));

      const { app, registrations } = createMockApp();
      goldenRecognizeFeature(app);
      const handler = registrations.message[0].handler;

      const client = buildClient();
      const message = {
        user: "Ugiver",
        text: "self-fistbump :goldenfistbump:",
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await handler({ message, client });

      expect(client.chat.postMessage.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const text = client.chat.postEphemeral.firstCall.args[0].text;
      expect(text).to.include("Sending gratitude failed");
      expect(text).to.include("You can't recognize yourself");
    });

    it("should dispatch handleSlackError when validateAndSendGratitude rejects with SlackError", async () => {
      stubRecognitionAssembly();
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(
          new SlackError(
            "users.info",
            "user_not_found",
            "Something went wrong with Slack",
          ),
        );

      const { app, registrations } = createMockApp();
      goldenRecognizeFeature(app);
      const handler = registrations.message[0].handler;

      const client = buildClient();
      const message = {
        user: "Ugiver",
        text: "hi <@Ureceiver> :goldenfistbump:",
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await handler({ message, client });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.equal(
        "Something went wrong with Slack",
      );
    });

    it("should dispatch handleGenericError when validateAndSendGratitude rejects with a plain Error", async () => {
      stubRecognitionAssembly();
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new Error("unexpected"));

      const { app, registrations } = createMockApp();
      goldenRecognizeFeature(app);
      const handler = registrations.message[0].handler;

      const client = buildClient();
      const message = {
        user: "Ugiver",
        text: "hi <@Ureceiver> :goldenfistbump:",
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await handler({ message, client });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const text = client.chat.postEphemeral.firstCall.args[0].text;
      expect(text).to.include("An unknown error occured in Gratibot");
      expect(text).to.include("unexpected");
    });
  });
});
