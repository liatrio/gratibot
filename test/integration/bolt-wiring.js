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
let refundFeature;
let stadiumFeature;
let balance;
let recognition;
let apiwrappers;
let deduction;
let stadium;
let config;
let GratitudeError;

function attachClientStubs(app) {
  const stubs = {
    usersInfo: sinon.stub().resolves({
      ok: true,
      user: { id: "Ucaller", name: "user1", tz: "America/Los_Angeles" },
    }),
    postEphemeral: sinon.stub().resolves(),
    postMessage: sinon.stub().resolves(),
    reactionsAdd: sinon.stub().resolves(),
    conversationsReplies: sinon.stub().resolves({
      ok: true,
      messages: [{ text: "thanks :fistbump:", user: "Ureceiver" }],
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

function makeApp({
  withBalance = false,
  withRecognize = false,
  withRefund = false,
  withStadium = false,
} = {}) {
  const app = new App({
    receiver: new NoOpReceiver(),
    token: "xoxb-test",
    botId: "Bbot",
    botUserId: "Ubot",
    tokenVerificationEnabled: false,
  });
  if (withBalance) balanceFeature(app);
  if (withRecognize) recognizeFeature(app);
  if (withRefund) refundFeature(app);
  if (withStadium) stadiumFeature(app);
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
      user: "Ucaller",
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
    refundFeature = require("../../features/refund");
    stadiumFeature = require("../../features/stadium-redeem");
    balance = require("../../service/balance");
    recognition = require("../../service/recognition");
    apiwrappers = require("../../service/apiwrappers");
    deduction = require("../../service/deduction");
    stadium = require("../../service/stadium");
    config = require("../../config");
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
          channel: "Ddm",
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
          channel: "Cchannel",
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
          channel: "Ddm",
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
          channel: "Ddm",
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

  describe("refund command routing", () => {
    it("keeps refund prose out of the Stadium resolution handler", async () => {
      const originalAdmins = [...config.redemptionAdmins];
      config.redemptionAdmins.splice(
        0,
        config.redemptionAdmins.length,
        "Ucaller",
      );
      try {
        const { app, stubs } = makeApp({
          withRefund: true,
          withStadium: true,
        });
        const genericRefund = sinon.stub(deduction, "refundDeduction");
        const stadiumResolve = sinon.stub(stadium, "resolveRedemption");

        await app.processEvent({
          body: eventBody({
            channelType: "im",
            channel: "Ddm",
            text: "refund 62171d78b5daaa0011771cfd — not the stadium resolve path",
            ts: "2.0",
            eventId: "Ev-refund-prose",
          }),
          ack: sinon.stub(),
        });

        sinon.assert.notCalled(genericRefund);
        sinon.assert.notCalled(stadiumResolve);
        expect(stubs.postMessage.callCount).to.equal(1);
        expect(stubs.postMessage.firstCall.args[0].text).to.equal(
          "Usage: `refund <deduction-id>`",
        );
      } finally {
        config.redemptionAdmins.splice(
          0,
          config.redemptionAdmins.length,
          ...originalAdmins,
        );
      }
    });

    it("routes a generic refund command after a newline", async () => {
      const originalAdmins = [...config.redemptionAdmins];
      config.redemptionAdmins.splice(
        0,
        config.redemptionAdmins.length,
        "Ucaller",
      );
      try {
        const { app } = makeApp({ withRefund: true });
        const genericRefund = sinon
          .stub(deduction, "refundDeduction")
          .resolves({ status: "refunded" });

        await app.processEvent({
          body: eventBody({
            channelType: "im",
            channel: "Ddm",
            text: "Refunding this one:\nrefund 62171d78b5daaa0011771cfd",
            ts: "2.1",
            eventId: "Ev-multiline-refund",
          }),
          ack: sinon.stub(),
        });

        sinon.assert.calledWith(genericRefund, "62171d78b5daaa0011771cfd");
      } finally {
        config.redemptionAdmins.splice(
          0,
          config.redemptionAdmins.length,
          ...originalAdmins,
        );
      }
    });

    it("routes malformed refunds to the usage response", async () => {
      const originalAdmins = [...config.redemptionAdmins];
      config.redemptionAdmins.splice(
        0,
        config.redemptionAdmins.length,
        "Ucaller",
      );
      try {
        const { app, stubs } = makeApp({ withRefund: true });
        const genericRefund = sinon.stub(deduction, "refundDeduction");

        await app.processEvent({
          body: eventBody({
            channelType: "im",
            channel: "Ddm",
            text: "refund 1234",
            ts: "2.2",
            eventId: "Ev-malformed-refund",
          }),
          ack: sinon.stub(),
        });

        sinon.assert.notCalled(genericRefund);
        expect(stubs.postMessage.firstCall.args[0].text).to.include("Usage:");
      } finally {
        config.redemptionAdmins.splice(
          0,
          config.redemptionAdmins.length,
          ...originalAdmins,
        );
      }
    });

    it("does not send a Stadium resolution through the generic refund handler", async () => {
      const originalAdmins = [...config.redemptionAdmins];
      config.redemptionAdmins.splice(
        0,
        config.redemptionAdmins.length,
        "Ucaller",
      );
      try {
        const { app, stubs } = makeApp({
          withRefund: true,
          withStadium: true,
        });
        const genericRefund = sinon.stub(deduction, "refundDeduction");
        sinon
          .stub(stadium, "resolveRedemption")
          .resolves({ status: "not_found" });

        await app.processEvent({
          body: eventBody({
            channelType: "im",
            channel: "Ddm",
            text: "stadium resolve stadium:T1:V1 refund",
            ts: "2.2",
            eventId: "Ev-stadium-refund",
          }),
          ack: sinon.stub(),
        });

        expect(genericRefund.called).to.equal(false);
        expect(stadium.resolveRedemption.calledOnce).to.equal(true);
        expect(stubs.postMessage.callCount).to.equal(1);
      } finally {
        config.redemptionAdmins.splice(
          0,
          config.redemptionAdmins.length,
          ...originalAdmins,
        );
      }
    });
  });

  describe("GratitudeError propagation through recognize", () => {
    it("posts the formatted user-facing message via postEphemeral when validateAndSendGratitude rejects with GratitudeError", async () => {
      const { app, stubs } = makeApp({ withRecognize: true });

      sinon.stub(recognition, "gratitudeReceiverIdsIn").resolves(["Ureceiver"]);
      sinon.stub(recognition, "trimmedGratitudeMessage").returns("trimmed");
      sinon.stub(recognition, "gratitudeTagsIn").returns([]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(apiwrappers, "userInfo")
        .resolves({ id: "Ucaller", tz: "America/Los_Angeles" });
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .rejects(new GratitudeError(["- You can't recognize yourself"]));

      await app.processEvent({
        body: eventBody({
          channelType: "channel",
          channel: "Cchannel",
          text: ":fistbump: <@Ureceiver> awesome",
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
