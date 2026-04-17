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

describe("features/redeem", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToRedeem", () => {
    it("should post Gratibot Rewards blocks via respondToUser", async () => {
      const { app, registrations } = createMockApp();
      redeemFeature(app);
      const handler = registrations.message[0].handler;

      sinon.stub(balance, "currentBalance").resolves(17);
      const fakeBlocks = [{ type: "section" }];
      sinon.stub(redeem, "createRedeemBlocks").returns(fakeBlocks);

      const client = buildClient();
      const message = {
        user: "U1",
        text: "redeem",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(balance.currentBalance.calledOnce).to.equal(true);
      expect(redeem.createRedeemBlocks.firstCall.args[0]).to.equal(17);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.equal("Gratibot Rewards");
      expect(args.blocks).to.equal(fakeBlocks);
    });
  });

  describe("redeemItem", () => {
    it("should post a message including cost and deduction ID for a non-Liatrio Store item on the happy path", async () => {
      const { app, registrations } = createMockApp();
      redeemFeature(app);
      const actionHandler = registrations.action[0].handler;

      sinon
        .stub(redeem, "getSelectedItemDetails")
        .returns({ itemName: "Sticker", itemCost: 5 });
      sinon.stub(deduction, "isBalanceSufficent").resolves(true);
      sinon.stub(deduction, "createDeduction").resolves("DED-1");

      const client = buildClient();
      const ack = sinon.stub().resolves();
      const body = {
        user: { id: "U1" },
        channel: { id: "D1" },
        actions: [
          { selected_option: { value: '{"name":"Sticker","cost":"5"}' } },
        ],
      };

      await actionHandler({ ack, body, context: { botToken: "xoxb" }, client });

      expect(ack.calledOnce).to.equal(true);
      expect(deduction.createDeduction.calledOnce).to.equal(true);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("<@U1> has selected Sticker");
      expect(text).to.include("for 5 fistbumps");
      expect(text).to.include("DED-1");
      expect(client.chat.postMessage.firstCall.args[0].channel).to.equal(
        "Dopen",
      );
    });

    it("should not create a deduction when the Liatrio Store is selected and should include the store link prompt", async () => {
      const { app, registrations } = createMockApp();
      redeemFeature(app);
      const actionHandler = registrations.action[0].handler;

      sinon
        .stub(redeem, "getSelectedItemDetails")
        .returns({ itemName: "Liatrio Store", itemCost: 100 });
      sinon.stub(deduction, "isBalanceSufficent").resolves(true);
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const ack = sinon.stub().resolves();
      const body = {
        user: { id: "U1" },
        channel: { id: "D1" },
        actions: [
          {
            selected_option: {
              value: '{"name":"Liatrio Store","cost":"100"}',
            },
          },
        ],
      };

      await actionHandler({ ack, body, context: { botToken: "xoxb" }, client });

      expect(createDeductionStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const text = client.chat.postMessage.firstCall.args[0].text;
      expect(text).to.include("Please provide the link");
    });

    it("should post an ephemeral insufficient-balance warning when balance is too low", async () => {
      const { app, registrations } = createMockApp();
      redeemFeature(app);
      const actionHandler = registrations.action[0].handler;

      sinon
        .stub(redeem, "getSelectedItemDetails")
        .returns({ itemName: "Sticker", itemCost: 500 });
      sinon.stub(deduction, "isBalanceSufficent").resolves(false);
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const ack = sinon.stub().resolves();
      const body = {
        user: { id: "U1" },
        channel: { id: "D1" },
        actions: [
          { selected_option: { value: '{"name":"Sticker","cost":"500"}' } },
        ],
      };

      await actionHandler({ ack, body, context: { botToken: "xoxb" }, client });

      expect(createDeductionStub.called).to.equal(false);
      expect(client.chat.postMessage.called).to.equal(false);
      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.include(
        "Your current balance isn't high enough",
      );
    });
  });
});
