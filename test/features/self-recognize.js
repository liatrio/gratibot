const sinon = require("sinon");
const expect = require("chai").expect;

const selfRecognizeFeature = require("../../features/self-recognize");
const recognition = require("../../service/recognition");
const config = require("../../config");
const { GratitudeError, SlackError } = require("../../service/errors");
const { createMockApp } = require("../mocks/bolt-app");

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

describe("features/self-recognize", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should assemble a self-gratitude object and react on the happy path", async () => {
    const { app, findHandler } = createMockApp();
    selfRecognizeFeature(app);
    const messageHandler = findHandler("message", config.selfRecognizeEmoji);

    sinon.stub(recognition, "validateAndSendSelfGratitude").resolves();
    sinon
      .stub(recognition, "giverSelfSlackNotification")
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
      text: "I crushed the demo today :self-fistbump:",
      channel: "Cchannel",
      ts: "1700000000.000100",
      channel_type: "channel",
    };

    await messageHandler({ message, client });

    expect(recognition.validateAndSendSelfGratitude.calledOnce).to.equal(true);
    const gratitude =
      recognition.validateAndSendSelfGratitude.firstCall.args[0];
    expect(gratitude.giver.id).to.equal("Ugiver");
    expect(gratitude.channel).to.equal("Cchannel");
    expect(gratitude.channelType).to.equal("channel");
    expect(gratitude.type).to.equal(config.selfRecognizeEmoji);
    expect(gratitude.count).to.equal(1);

    expect(client.reactions.add.calledOnce).to.equal(true);
  });

  it("should route GratitudeError through handleGratitudeError and not react", async () => {
    const { app, findHandler } = createMockApp();
    selfRecognizeFeature(app);
    const messageHandler = findHandler("message", config.selfRecognizeEmoji);

    sinon
      .stub(recognition, "validateAndSendSelfGratitude")
      .rejects(
        new GratitudeError([
          `- ${config.selfRecognizeEmoji} can only be used in public channels`,
        ]),
      );

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
      text: ":self-fistbump: trying this from a DM 1234567890",
      channel: "Dchannel",
      ts: "1700000000.000100",
      channel_type: "im",
    };

    await messageHandler({ message, client });

    expect(client.reactions.add.called).to.equal(false);
    const responseCall =
      client.chat.postMessage.called && client.chat.postMessage.firstCall
        ? client.chat.postMessage.firstCall
        : client.chat.postEphemeral.firstCall;
    expect(responseCall.args[0].text).to.include("Sending gratitude failed");
    expect(responseCall.args[0].text).to.include("public channels");
  });

  it("should route SlackError through handleSlackError and not react", async () => {
    const { app, findHandler } = createMockApp();
    selfRecognizeFeature(app);
    const messageHandler = findHandler("message", config.selfRecognizeEmoji);

    sinon
      .stub(recognition, "validateAndSendSelfGratitude")
      .rejects(
        new SlackError("users.info", "user_not_found", "slack-error-message"),
      );

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
      text: ":self-fistbump: I did good 1234567890",
      channel: "Cchannel",
      ts: "1700000000.000100",
      channel_type: "channel",
    };

    await messageHandler({ message, client });

    expect(client.reactions.add.called).to.equal(false);
    expect(client.chat.postEphemeral.calledOnce).to.equal(true);
    expect(client.chat.postEphemeral.firstCall.args[0].text).to.equal(
      "slack-error-message",
    );
  });

  it("should route a plain Error through handleGenericError", async () => {
    const { app, findHandler } = createMockApp();
    selfRecognizeFeature(app);
    const messageHandler = findHandler("message", config.selfRecognizeEmoji);

    sinon
      .stub(recognition, "validateAndSendSelfGratitude")
      .rejects(new Error("boom"));

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
      text: ":self-fistbump: I did good 1234567890",
      channel: "Cchannel",
      ts: "1700000000.000100",
      channel_type: "channel",
    };

    await messageHandler({ message, client });

    expect(client.reactions.add.called).to.equal(false);
    expect(client.chat.postEphemeral.calledOnce).to.equal(true);
    const text = client.chat.postEphemeral.firstCall.args[0].text;
    expect(text).to.include("An unknown error occurred in Gratibot");
    expect(text).to.include("boom");
  });
});
