const sinon = require("sinon");
const expect = require("chai").expect;

const redeemFeature = require("../../features/redeem");
const balance = require("../../service/balance");
const deduction = require("../../service/deduction");
const redeem = require("../../service/redeem");
const { createMockApp } = require("../mocks/bolt-app");

function buildClient() {
  return {
    conversations: {
      open: sinon.stub().resolves({ channel: { id: "Dopen" } }),
      list: sinon.stub().resolves({ ok: true, channels: [] }),
    },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
  };
}

const USER_REDEEM_MATCHER = /redeem/i;

describe("features/redeem", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToRedeem", () => {
    it("should post Gratibot Rewards blocks via respondToUser", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const handler = findHandler("message", USER_REDEEM_MATCHER);

      sinon.stub(balance, "currentBalance").resolves(17);
      const fakeRewards = [{ name: "Widget" }];
      const fakeBlocks = [{ type: "section" }];
      sinon.stub(redeem, "fetchActiveRewards").resolves(fakeRewards);
      sinon.stub(redeem, "buildRedeemBlocks").returns(fakeBlocks);

      const client = buildClient();
      const message = {
        user: "Ucaller",
        text: "redeem",
        channel: "Ddm",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(balance.currentBalance.calledOnce).to.equal(true);
      expect(redeem.fetchActiveRewards.calledOnce).to.equal(true);
      expect(redeem.buildRedeemBlocks.firstCall.args[0]).to.equal(fakeRewards);
      expect(redeem.buildRedeemBlocks.firstCall.args[1]).to.equal(17);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.equal("Gratibot Rewards");
      expect(args.blocks).to.equal(fakeBlocks);
    });
  });

  describe("redeemItem", () => {
    function bodyWithRewardId(id) {
      return {
        user: { id: "Ucaller" },
        channel: { id: "Ddm" },
        actions: [{ selected_option: { value: id } }],
      };
    }

    it("should look up the reward by id from the payload and use the DB cost/name for deduction", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R1",
        name: "Sticker",
        cost: 5,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      sinon.stub(deduction, "createDeduction").resolves("DED-1");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R1"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(ack.calledOnce).to.equal(true);
      expect(redeem.fetchActiveRewardById.calledWith("R1")).to.equal(true);
      expect(deduction.createDeduction.calledOnce).to.equal(true);
      expect(deduction.createDeduction.firstCall.args[1]).to.equal(5);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("<@Ucaller> has selected Sticker");
      expect(text).to.include("for 5 fistbumps");
      expect(text).to.include("DED-1");
      expect(client.chat.postMessage.firstCall.args[0].channel).to.equal(
        "Dopen",
      );
    });

    it("should bail with an ephemeral when the reward is no longer available", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves(null);
      const balanceStub = sinon.stub(deduction, "isBalanceSufficient");
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("deleted-id"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(balanceStub.called).to.equal(false);
      expect(createDeductionStub.called).to.equal(false);
      expect(client.conversations.open.called).to.equal(false);
      expect(client.chat.postMessage.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.include(
        "no longer available",
      );
    });

    it("should branch on kind === 'liatrio-store' from the DB row and skip createDeduction", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R2",
        name: "Some Other Display Name",
        cost: 0,
        kind: "liatrio-store",
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R2"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(createDeductionStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("Please provide the link");
    });

    it("should call createDeduction for a regular (non-Liatrio-Store) kind", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R3",
        name: "Liatrio Store",
        cost: 50,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      const createDeductionStub = sinon
        .stub(deduction, "createDeduction")
        .resolves("DED-2");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R3"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(createDeductionStub.calledOnce).to.equal(true);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("for 50 fistbumps");
      expect(text).to.include("DED-2");
    });

    it("should use the current DB cost, not any prior value, when an admin has edited the reward", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      // Simulate the exact bug: payload arrived for a reward whose price has
      // since changed. The flow must use the current DB cost (99), never the
      // old cost the dialog might have rendered.
      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R4",
        name: "Mug",
        cost: 99,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      const createDeductionStub = sinon
        .stub(deduction, "createDeduction")
        .resolves("DED-3");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R4"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(createDeductionStub.firstCall.args[1]).to.equal(99);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("for 99 fistbumps");
    });

    it("should post an ephemeral insufficient-balance warning when balance is too low", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R5",
        name: "Sticker",
        cost: 500,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(false);
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R5"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(createDeductionStub.called).to.equal(false);
      expect(client.conversations.open.called).to.equal(false);
      expect(client.chat.postMessage.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.include(
        "Your current balance isn't high enough",
      );
    });

    it("should notify the user via postEphemeral when the redemption flow throws", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R6",
        name: "Sticker",
        cost: 5,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      const client = buildClient();
      client.conversations.open = sinon.stub().rejects(new Error("boom"));
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R6"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const call = client.chat.postEphemeral.firstCall.args[0];
      expect(call.channel).to.equal("Ddm");
      expect(call.user).to.equal("Ucaller");
      expect(call.text).to.include("Something went wrong");
    });

    it("should swallow a postEphemeral failure in the catch block without rejecting", async () => {
      const { app, findHandler } = createMockApp();
      redeemFeature(app);
      const actionHandler = findHandler("action", { action_id: "redeem" });

      sinon.stub(redeem, "fetchActiveRewardById").resolves({
        _id: "R7",
        name: "Sticker",
        cost: 5,
        kind: null,
      });
      sinon.stub(deduction, "isBalanceSufficient").resolves(true);
      const client = buildClient();
      client.conversations.open = sinon.stub().rejects(new Error("boom"));
      client.chat.postEphemeral = sinon.stub().rejects(new Error("also boom"));
      const ack = sinon.stub().resolves();

      await actionHandler({
        ack,
        body: bodyWithRewardId("R7"),
        context: { botToken: "xoxb" },
        client,
      });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
    });
  });
});
