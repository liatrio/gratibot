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

function submission(
  amount = "5",
  email = "person@liatrio.com",
  emailSource = "modal",
) {
  const values = {
    stadium_amount: {
      stadium_amount_value: { value: amount },
    },
  };
  if (emailSource === "modal") {
    values.stadium_email = {
      stadium_email_value: { value: email },
    };
  }
  return {
    body: { user: { id: "U1" }, team: { id: "T1" } },
    view: {
      id: "V1",
      private_metadata: JSON.stringify({ emailSource }),
      state: {
        values,
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
      emailSource: config.stadium.emailSource,
      storeUrl: config.stadium.storeUrl,
    };
    originalAdmins = [...config.redemptionAdmins];
    Object.assign(config.stadium, {
      enabled: true,
      emailSource: "modal",
      storeUrl: "https://stadium.example/",
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

  it("surfaces a specific configuration error when the modal cannot be built", async () => {
    config.stadium.emailSource = "invalid";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("action", {
      action_id: "stadium_redeem_open",
    });
    const slack = client();

    await handler({
      ack: sinon.stub().resolves(),
      body: { user: { id: "U1" }, trigger_id: "trigger" },
      client: slack,
    });

    expect(slack.views.open.called).to.equal(false);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "email settings are invalid",
    );
    expect(slack.chat.postMessage.firstCall.args[0].text).not.to.include(
      "try again",
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
    expect(ack.firstCall.args[0].errors).to.have.property("stadium_amount");
  });

  it("keeps the modal open with all manual-input validation errors", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const ack = sinon.stub().resolves();
    const redeem = sinon.stub(stadium, "redeem");

    await handler({
      ack,
      client: client(),
      ...submission("1.5", "person@example.com"),
    });

    expect(ack.firstCall.args[0]).to.deep.equal({
      response_action: "errors",
      errors: {
        stadium_amount: "Enter a valid whole-number fistbump amount.",
        stadium_email: "Enter a valid @liatrio.com email address.",
      },
    });
    sinon.assert.notCalled(redeem);
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

  it("fails closed when the email source is invalid", async () => {
    config.stadium.emailSource = "fallback";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    const ack = sinon.stub().resolves();
    const redeem = sinon.stub(stadium, "redeem");

    await handler({ ack, client: slack, ...submission() });

    expect(ack.calledOnce).to.equal(true);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "email settings are invalid",
    );
    sinon.assert.notCalled(redeem);
  });

  it("rejects a stale Slack-source modal after settings switch to modal", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    const ack = sinon.stub().resolves();
    const redeem = sinon.stub(stadium, "redeem");
    const stale = submission("5", undefined, "slack");

    await handler({ ack, client: slack, ...stale });

    expect(ack.calledWithExactly()).to.equal(true);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "settings changed",
    );
    sinon.assert.notCalled(slack.users.info);
    sinon.assert.notCalled(redeem);
  });

  it("supports a legacy modal without email-source metadata", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    const legacy = submission();
    delete legacy.view.private_metadata;
    const redeem = sinon.stub(stadium, "redeem").resolves({
      status: "fulfilled",
      stadiumPoints: 5,
    });

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...legacy,
    });

    sinon.assert.calledWith(redeem, {
      user: "U1",
      email: "person@liatrio.com",
      fistbumps: 5,
      redemptionId: "T1:V1",
    });
  });

  it("rejects a stale modal-source modal after settings switch to Slack", async () => {
    config.stadium.emailSource = "slack";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    const ack = sinon.stub().resolves();
    const redeem = sinon.stub(stadium, "redeem");

    await handler({ ack, client: slack, ...submission() });

    expect(ack.calledWithExactly()).to.equal(true);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "settings changed",
    );
    sinon.assert.notCalled(slack.users.info);
    sinon.assert.notCalled(redeem);
  });

  it("rejects invalid modal metadata and asks the user to reopen", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    const ack = sinon.stub().resolves();
    const invalid = submission();
    invalid.view.private_metadata = "not-json";

    await handler({ ack, client: slack, ...invalid });

    expect(ack.calledWithExactly()).to.equal(true);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "no longer valid",
    );
  });

  it("uses a normalized manual email without reading the Slack profile", async () => {
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
    await handler({
      ack,
      client: slack,
      ...submission("5", " Person@Liatrio.com "),
    });
    expect(ack.calledOnce).to.equal(true);
    sinon.assert.notCalled(slack.users.info);
    sinon.assert.calledWith(stadium.redeem, {
      user: "U1",
      email: "person@liatrio.com",
      fistbumps: 5,
      redemptionId: "T1:V1",
    });
    const message = slack.chat.postMessage.firstCall.args[0].text;
    expect(message).to.include(
      "5 fistbumps were exchanged for 5 Stadium points and sent to person@liatrio.com.",
    );
    expect(message).to.include("Your Stadium gift is ready to redeem");
    expect(message).to.include("<https://stadium.example/|Open Stadium>");
    expect(message).to.include("select *Redeem Gift*");
    expect(message).not.to.include("SSO");
  });

  it("retains automatic Slack email lookup when configured", async () => {
    config.stadium.emailSource = "slack";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "fulfilled",
      stadiumPoints: 5,
      orderNumber: "ORDER",
    });
    const slack = client();

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission("5", undefined, "slack"),
    });

    sinon.assert.calledWithExactly(slack.users.info, { user: "U1" });
    sinon.assert.calledWith(stadium.redeem, {
      user: "U1",
      email: "person@liatrio.com",
      fistbumps: 5,
      redemptionId: "T1:V1",
    });
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "sent to person@liatrio.com",
    );
  });

  it("uses plain Open Stadium text when no store URL is configured", async () => {
    config.stadium.storeUrl = "";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    sinon.stub(stadium, "redeem").resolves({
      status: "fulfilled",
      stadiumPoints: 5,
    });
    const slack = client();

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission(),
    });

    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "Open Stadium and select *Redeem Gift*",
    );
    expect(slack.chat.postMessage.firstCall.args[0].text).not.to.include("<");
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

  it("returns the safe corporate-email requirement inline", async () => {
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const redeem = sinon.stub(stadium, "redeem");
    const slack = client();
    const ack = sinon.stub().resolves();

    await handler({
      ack,
      client: slack,
      ...submission("5", "person@example.com"),
    });

    expect(ack.firstCall.args[0].errors.stadium_email).to.equal(
      "Enter a valid @liatrio.com email address.",
    );
    sinon.assert.notCalled(redeem);
    sinon.assert.notCalled(slack.chat.postMessage);
  });

  it("does not describe a Slack profile lookup failure as uncertain", async () => {
    config.stadium.emailSource = "slack";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    slack.users.info.rejects(new Error("missing_scope"));
    const redeem = sinon.stub(stadium, "redeem");

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission("5", undefined, "slack"),
    });

    sinon.assert.notCalled(redeem);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "couldn't read your corporate email",
    );
    expect(slack.chat.postMessage.firstCall.args[0].text).not.to.include(
      "final status",
    );
  });

  it("directs an invalid Slack profile email back to the profile", async () => {
    config.stadium.emailSource = "slack";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    slack.users.info.resolves({
      ok: true,
      user: { profile: { email: "person@example.com" } },
    });
    const redeem = sinon.stub(stadium, "redeem");

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission("5", undefined, "slack"),
    });

    sinon.assert.notCalled(redeem);
    const message = slack.chat.postMessage.firstCall.args[0].text;
    expect(message).to.include(
      "Slack profile must contain a valid @liatrio.com email address",
    );
    expect(message).not.to.include("Enter a valid");
  });

  it("does not redeem when Slack returns no profile email", async () => {
    config.stadium.emailSource = "slack";
    const { app, findHandler } = createMockApp();
    stadiumFeature(app);
    const handler = findHandler("view", "stadium_redeem_submit");
    const slack = client();
    slack.users.info.resolves({ ok: true, user: { profile: {} } });
    const redeem = sinon.stub(stadium, "redeem");

    await handler({
      ack: sinon.stub().resolves(),
      client: slack,
      ...submission("5", undefined, "slack"),
    });

    sinon.assert.notCalled(redeem);
    expect(slack.chat.postMessage.firstCall.args[0].text).to.include(
      "couldn't read your corporate email",
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
      "confirmed the paid order",
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
