// Integration suite that drives a real @slack/bolt App through processEvent
// against a no-op Receiver. Three assertions:
//  (a) directMessage() routes only DM events; the channel-equivalent event
//      is filtered out.
//  (b) the regex matcher on app.message() filters by message text.
//  (c) when service/recognition.validateAndSendGratitude rejects with
//      GratitudeError, the feature's catch path responds via the captured
//      Slack client stub with the expected user-facing message.
//
// Requires for feature/service modules live inside before() so they run
// AFTER the root beforeAll in test/integration/setup.js patches the cached
// config.mongo_url. Otherwise the transitive require of database/db.js
// would construct a MongoClient bound to the default URL before the
// memory-server URI is in place, breaking the other integration suites.

const sinon = require("sinon");
const expect = require("chai").expect;
const { App } = require("@slack/bolt");

const { NoOpReceiver } = require("../mocks/bolt-receiver");

let balanceFeature;
let recognizeFeature;
let balance;
let recognition;
let apiwrappers;
let GratitudeError;

function attachClientStubs(app) {
  const stubs = {
    usersInfo: sinon.stub().resolves({
      ok: true,
      user: { id: "U1", name: "user1", tz: "America/Los_Angeles" },
    }),
    postEphemeral: sinon.stub().resolves(),
    postMessage: sinon.stub().resolves(),
    reactionsAdd: sinon.stub().resolves(),
    conversationsReplies: sinon.stub().resolves({
      ok: true,
      messages: [{ text: "thanks :fistbump:", user: "U2" }],
    }),
  };
  app.use(async ({ client, next }) => {
    client.users.info = stubs.usersInfo;
    client.chat.postEphemeral = stubs.postEphemeral;
    client.chat.postMessage = stubs.postMessage;
    client.reactions.add = stubs.reactionsAdd;
    client.conversations.replies = stubs.conversationsReplies;
    await next();
  });
  return stubs;
}

function makeApp({ withBalance = false, withRecognize = false } = {}) {
  const app = new App({
    receiver: new NoOpReceiver(),
    token: "xoxb-test",
    botId: "Bbot",
    botUserId: "Ubot",
    tokenVerificationEnabled: false,
  });
  if (withBalance) balanceFeature(app);
  if (withRecognize) recognizeFeature(app);
  const stubs = attachClientStubs(app);
  return { app, stubs };
}

function eventBody({ channelType, channel, text, ts, eventId }) {
  return {
    type: "event_callback",
    team_id: "T1",
    api_app_id: "A1",
    event: {
      type: "message",
      channel_type: channelType,
      channel,
      user: "U1",
      text,
      ts,
    },
    event_id: eventId,
    event_time: 1234567890,
  };
}

describe("integration: bolt-wiring", function () {
  this.timeout(30000);

  before(() => {
    balanceFeature = require("../../features/balance");
    recognizeFeature = require("../../features/recognize");
    balance = require("../../service/balance");
    recognition = require("../../service/recognition");
    apiwrappers = require("../../service/apiwrappers");
    ({ GratitudeError } = require("../../service/errors"));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("directMessage routing", () => {
    it("fires the balance handler for a DM event and not for a channel-equivalent event", async () => {
      const { app, stubs } = makeApp({ withBalance: true });
      sinon.stub(balance, "currentBalance").resolves(7);
      sinon.stub(balance, "lifetimeEarnings").resolves(15);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(3);

      await app.processEvent({
        body: eventBody({
          channelType: "im",
          channel: "Duser",
          text: "balance",
          ts: "1.0",
          eventId: "Ev-dm",
        }),
        ack: sinon.stub(),
      });

      expect(balance.currentBalance.callCount).to.equal(1);
      expect(stubs.postMessage.callCount).to.equal(1);
      expect(stubs.postMessage.firstCall.args[0].text).to.include(
        "Your current balance is: `7`",
      );

      stubs.postMessage.resetHistory();
      balance.currentBalance.resetHistory();

      await app.processEvent({
        body: eventBody({
          channelType: "channel",
          channel: "Croom",
          text: "balance",
          ts: "1.1",
          eventId: "Ev-chan",
        }),
        ack: sinon.stub(),
      });

      expect(balance.currentBalance.callCount).to.equal(0);
      expect(stubs.postMessage.callCount).to.equal(0);
    });
  });

  describe("regex / string message matcher", () => {
    it("fires the balance handler when message text matches /balance/i and not when it does not match", async () => {
      const { app, stubs } = makeApp({ withBalance: true });
      sinon.stub(balance, "currentBalance").resolves(1);
      sinon.stub(balance, "lifetimeEarnings").resolves(2);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(4);

      await app.processEvent({
        body: eventBody({
          channelType: "im",
          channel: "Duser",
          text: "balance",
          ts: "2.0",
          eventId: "Ev-match",
        }),
        ack: sinon.stub(),
      });

      expect(balance.currentBalance.callCount).to.equal(1);
      expect(stubs.postMessage.callCount).to.equal(1);

      stubs.postMessage.resetHistory();
      balance.currentBalance.resetHistory();

      await app.processEvent({
        body: eventBody({
          channelType: "im",
          channel: "Duser",
          text: "not a recognized command",
          ts: "2.1",
          eventId: "Ev-nomatch",
        }),
        ack: sinon.stub(),
      });

      expect(balance.currentBalance.callCount).to.equal(0);
      expect(stubs.postMessage.callCount).to.equal(0);
    });
  });

  describe("GratitudeError propagation through recognize", () => {
    it("posts the formatted user-facing message via postEphemeral when validateAndSendGratitude rejects with GratitudeError", async () => {
      const { app, stubs } = makeApp({ withRecognize: true });

      sinon.stub(recognition, "gratitudeReceiverIdsIn").resolves(["U2"]);
      sinon.stub(recognition, "trimmedGratitudeMessage").returns("trimmed");
      sinon.stub(recognition, "gratitudeTagsIn").returns([]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(apiwrappers, "userInfo")
        .resolves({ id: "U1", tz: "America/Los_Angeles" });
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new GratitudeError(["- You can't recognize yourself"]));

      await app.processEvent({
        body: eventBody({
          channelType: "channel",
          channel: "Croom",
          text: ":fistbump: <@U2> awesome",
          ts: "3.0",
          eventId: "Ev-grat",
        }),
        ack: sinon.stub(),
      });

      expect(recognition.validateAndSendGratitude.callCount).to.equal(1);
      expect(stubs.postEphemeral.callCount).to.equal(1);
      const args = stubs.postEphemeral.firstCall.args[0];
      expect(args.text).to.include("Sending gratitude failed");
      expect(args.text).to.include("You can't recognize yourself");
    });
  });
});
