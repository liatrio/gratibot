const sinon = require("sinon");
const expect = require("chai").expect;

const config = require("../../config");
const stadiumFeature = require("../../features/stadium-redeem");
const stadium = require("../../service/stadium");
const { createMockApp } = require("../mocks/bolt-app");

function client() {
  return {
    views: { open: sinon.stub().resolves() },
    users: {
      info: sinon.stub().resolves({
        ok: true,
        user: { profile: { email: "person@liatrio.com" } },
      }),
    },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
  };
}

function submission(amount = "5") {
  return {
    body: { user: { id: "U1" }, team: { id: "T1" } },
    view: {
      id: "V1",
      state: {
        values: {
          stadium_amount: {
            stadium_amount_value: { value: amount },
          },
        },
      },
    },
  };
}

describe("features/stadium-redeem", () => {
  let originalEnabled;
  let originalRatio;
  let originalAdmins;

  beforeEach(() => {
    originalEnabled = config.stadium.enabled;
    originalRatio = {
      fistbumpsPerUnit: config.stadium.fistbumpsPerUnit,
      pointsPerUnit: config.stadium.pointsPerUnit,
      minimumFistbumps: config.stadium.minimumFistbumps,
      maximumFistbumps: config.stadium.maximumFistbumps,
    };
    originalAdmins = [...config.redemptionAdmins];
    Object.assign(config.stadium, {
      enabled: true,
      fistbumpsPerUnit: 1,
      pointsPerUnit: 1,
      minimumFistbumps: 1,
      maximumFistbumps: null,
    });
  });

  afterEach(() => {
    config.stadium.enabled = originalEnabled;
    Object.assign(config.stadium, originalRatio);
    config.redemptionAdmins.splice(
      0,
      config.redemptionAdmins.length,
      ...originalAdmins,
    );
    sinon.restore();
  });

  it("opens the redemption modal without waiting for a balance query", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("action", {
      action_id: "stadium_redeem_open",
    });
    sinon.stub(stadium, "buildRedemptionModal").returns({ type: "modal" });
    const slack = client();
    const ack = sinon.stub().resolves();
    await handler({
      ack,
      body: { user: { id: "U1" }, trigger_id: "trigger" },
      client: slack,
    });
    expect(ack.calledBefore(slack.views.open)).to.equal(true);
    sinon.assert.calledWith(slack.views.open, {
      trigger_id: "trigger",
      view: { type: "modal" },
    });
    sinon.assert.calledWithExactly(stadium.buildRedemptionModal);
  });

  it("notifies the user when a stale redemption button is disabled", async () => {
    config.stadium.enabled = false;
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("action", {
      action_id: "stadium_redeem_open",
    });
    const slack = client();
    const ack = sinon.stub().resolves();

    await handler({
      ack,
      body: { user: { id: "U1" }, trigger_id: "trigger" },
      client: slack,
    });

    expect(ack.calledOnce).to.equal(true);
    expect(slack.views.open.called).to.equal(false);
    expect(slack.chat.postMessage.firstCall.args[0]).to.include({
      channel: "U1",
      text: "Stadium redemption is currently unavailable.",
    });
  });

  it("notifies the user when the redemption modal cannot be opened", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("action", {
      action_id: "stadium_redeem_open",
    });
    const slack = client();
    slack.views.open.rejects(new Error("expired_trigger_id"));

    await handler({
      ack: sinon.stub().resolves(),
      body: { user: { id: "U1" }, trigger_id: "trigger" },
      client: slack,
    });

    expect(slack.chat.postMessage.firstCall.args[0]).to.include({
      channel: "U1",
    });
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "couldn't open",
    );
  });

  it("keeps the modal open with a validation error for an invalid amount", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const ack = sinon.stub().resolves();
    await handler({ ack, client: client(), ...submission("1.5") });
    expect(ack.firstCall.args[0]).to.deep.include({
      response_action: "errors",
    });
  });

  it("rejects a stale modal submission when the integration is disabled", async () => {
    config.stadium.enabled = false;
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });
    expect(slack.users.info.called).to.equal(false);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "currently unavailable",
    );
  });

  it("reads Slack email and fulfills with a deterministic view id", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "fulfilled",
      stadiumPoints: 5,
      orderNumber: "ORDER",
    });
    const slack = client();
    const ack = sinon.stub().resolves();
    await handler({ ack, client: slack, ...submission() });
    expect(ack.calledOnce).to.equal(true);
    sinon.assert.calledWith(stadium.redeem, {
      user: "U1",
      email: "person@liatrio.com",
      fistbumps: 5,
      redemptionId: "T1:V1",
    });
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "5 Stadium points",
    );
  });

  it("does not expose internal errors to the user", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon
      .stub(stadium, "redeem")
      .rejects(new Error("mongodb://internal-host secret detail"));
    const slack = client();
    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });
    const text = slack.chat.postMessage.firstCall.args[0].text;
    expect(text).to.include("couldn't confirm the final status");
    expect(text).not.to.include("mongodb");
    expect(text).not.to.include("secret detail");
  });

  it("does not describe a completed redemption as unsubmitted when notification fails", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "fulfilled",
      id: "stadium:T1:V1",
      stadiumPoints: 5,
      orderNumber: "ORDER",
    });
    const slack = client();
    slack.chat.postMessage.onFirstCall().rejects(new Error("slack failed"));
    slack.chat.postMessage.onSecondCall().resolves();

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });

    expect(slack.chat.postMessage.secondCall.args[0].text).to.include(
      "was processed",
    );
    expect(slack.chat.postMessage.secondCall.args[0].text).not.to.include(
      "not lost",
    );
  });

  it("surfaces the safe corporate-email requirement", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").rejects(
      new stadium.StadiumError("internal validation detail", "definite", {
        userMessage:
          "Stadium redemption requires a liatrio.com email in your Slack profile.",
      }),
    );
    const slack = client();

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });

    expect(slack.chat.postMessage.firstCall.args[0].text).to.equal(
      "Stadium redemption requires a liatrio.com email in your Slack profile.",
    );
  });

  it("does not describe a Slack profile lookup failure as uncertain", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    slack.users.info.rejects(new Error("missing_scope"));
    const redeem = sinon.stub(stadium, "redeem");

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });

    sinon.assert.notCalled(redeem);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "couldn't read your corporate email",
    );
    expect(slack.chat.postMessage.firstCall.args[0].text).not.to.include(
      "final status",
    );
  });

  it("notifies the user and admins when fulfillment needs review", async () => {
    config.redemptionAdmins.splice(0, config.redemptionAdmins.length, "UA");
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "needs_review",
      id: "stadium:T1:V1",
    });
    sinon
      .stub(stadium, "claimReviewNotification")
      .resolves({ claimId: "claim-1" });
    const completeNotification = sinon
      .stub(stadium, "completeReviewNotification")
      .resolves({ modifiedCount: 1 });
    const slack = client();
    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });
    expect(slack.chat.postMessage.callCount).to.equal(2);
    expect(slack.chat.postMessage.secondCall.args[0]).to.include({
      channel: "UA",
    });
    expect(slack.chat.postMessage.secondCall.args[0].text).to.include(
      "stadium resolve stadium:T1:V1 fulfilled",
    );
    expect(slack.chat.postMessage.secondCall.args[0].text).to.include(
      "stadium resolve stadium:T1:V1 refund",
    );
    sinon.assert.calledWith(
      completeNotification,
      "stadium:T1:V1",
      "claim-1",
      true,
    );
  });

  it("notifies the user and admins about a late fulfillment conflict", async () => {
    config.redemptionAdmins.splice(0, config.redemptionAdmins.length, "UA");
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "resolution_conflict",
      id: "stadium:T1:V1",
      terminalStatus: "refunded",
      orderNumber: "ORDER",
    });
    const slack = client();

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });

    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "confirmed the points",
    );
    expect(slack.chat.postMessage.secondCall.args[0]).to.include({
      channel: "UA",
    });
    expect(slack.chat.postMessage.secondCall.args[0].text).to.include("ORDER");
  });

  it("lists unresolved redemptions for admins", async () => {
    config.redemptionAdmins.splice(0, config.redemptionAdmins.length, "UA");
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("message", /\bstadium review\b/i);
    sinon
      .stub(stadium, "reviewRedemptions")
      .resolves([{ _id: "stadium:T:V", user: "U1", value: 5 }]);
    const slack = client();
    await handler({
      message: {
        user: "UA",
        channel: "D1",
        channel_type: "im",
        text: "stadium review",
      },
      client: slack,
    });
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "stadium:T:V",
    );
  });

  it("resolves an uncertain redemption and informs its owner", async () => {
    config.redemptionAdmins.splice(0, config.redemptionAdmins.length, "UA");
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler(
      "message",
      /^(?!.*\brefund\b.*\bstadium\s+resolve\b).*\bstadium\s+resolve\b/is,
    );
    sinon.stub(stadium, "resolveRedemption").resolves({
      status: "refunded",
      record: { user: "U1" },
    });
    const slack = client();
    await handler({
      message: {
        user: "UA",
        channel: "D1",
        channel_type: "im",
        text: "stadium resolve stadium:T:V refund",
      },
      client: slack,
    });
    sinon.assert.calledWith(
      stadium.resolveRedemption,
      "stadium:T:V",
      "refund",
      "UA",
    );
    expect(slack.chat.postMessage.secondCall.args[0]).to.include({
      channel: "U1",
    });
  });

  it("accepts a review id copied with backticks", async () => {
    config.redemptionAdmins.splice(0, config.redemptionAdmins.length, "UA");
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler(
      "message",
      /^(?!.*\brefund\b.*\bstadium\s+resolve\b).*\bstadium\s+resolve\b/is,
    );
    sinon.stub(stadium, "resolveRedemption").resolves({
      status: "fulfilled",
    });

    await handler({
      message: {
        user: "UA",
        channel: "D1",
        channel_type: "im",
        text: "stadium resolve `stadium:T:V` fulfilled",
      },
      client: client(),
    });

    sinon.assert.calledWith(
      stadium.resolveRedemption,
      "stadium:T:V",
      "fulfilled",
      "UA",
    );
  });
});
