const sinon = require("sinon");
const expect = require("chai").expect;

const recognizeFeature = require("../../features/recognize");
const recognition = require("../../service/recognition");
const { GratitudeError } = require("../../service/errors");
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
      const { app, registrations } = createMockApp();
      recognizeFeature(app);
      const messageHandler = registrations.message[0].handler;

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
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      expect(recognition.validateAndSendGratitude.calledOnce).to.equal(true);
      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver.id).to.equal("Ugiver");
      expect(gratitude.receivers.map((r) => r.id)).to.deep.equal(["Ureceiver"]);
      expect(gratitude.giver_in_receivers).to.equal(false);
      expect(gratitude.channel).to.equal("C999");
      expect(gratitude.type).to.equal(":fistbump:");

      expect(client.reactions.add.calledOnce).to.equal(true);
      const reactionArgs = client.reactions.add.firstCall.args[0];
      expect(reactionArgs.channel).to.equal("C999");
      expect(reactionArgs.timestamp).to.equal("1700000000.000100");
    });

    it("should flag giver_in_receivers when the giver also appears in the receiver list", async () => {
      const { app, registrations } = createMockApp();
      recognizeFeature(app);
      const messageHandler = registrations.message[0].handler;

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
        channel: "C999",
        ts: "1700000000.000100",
        channel_type: "channel",
      };

      await messageHandler({ message, client });

      const gratitude = recognition.validateAndSendGratitude.firstCall.args[0];
      expect(gratitude.giver_in_receivers).to.equal(true);
    });

    it("should route GratitudeError through handleGratitudeError and not react to the message", async () => {
      const { app, registrations } = createMockApp();
      recognizeFeature(app);
      const messageHandler = registrations.message[0].handler;

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
        channel: "C999",
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
});
