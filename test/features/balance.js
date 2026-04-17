const sinon = require("sinon");
const expect = require("chai").expect;

const balanceFeature = require("../../features/balance");
const balance = require("../../service/balance");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/balance", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToBalance", () => {
    it("should post the three-line balance text via respondToUser on the happy path", async () => {
      const { app, findHandler } = createMockApp();
      balanceFeature(app);
      const messageHandler = findHandler("message", /balance/i);

      sinon.stub(balance, "currentBalance").resolves(42);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);

      const client = {
        users: {
          info: sinon
            .stub()
            .resolves({ ok: true, user: { tz: "America/Los_Angeles" } }),
        },
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
      };
      const message = {
        user: "U1",
        text: "balance",
        channel: "D1",
        channel_type: "im",
      };

      await messageHandler({ message, client });

      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.channel).to.equal("D1");
      expect(args.text).to.include("Your current balance is: `42`");
      expect(args.text).to.include("Your lifetime earnings are: `100`");
      expect(args.text).to.include("You have `5` left to give away today.");
      expect(balance.dailyGratitudeRemaining.firstCall.args[1]).to.equal(
        "America/Los_Angeles",
      );
    });

    it("should post an error message when users.info returns ok: false", async () => {
      const { app, findHandler } = createMockApp();
      balanceFeature(app);
      const messageHandler = findHandler("message", /balance/i);

      const currentBalanceStub = sinon.stub(balance, "currentBalance");

      const client = {
        users: {
          info: sinon.stub().resolves({ ok: false, error: "user_not_found" }),
        },
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
      };
      const message = {
        user: "U1",
        text: "balance",
        channel: "D1",
        channel_type: "im",
      };

      await messageHandler({ message, client });

      expect(currentBalanceStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.include(
        "Something went wrong while obtaining your balance",
      );
      expect(args.text).to.include("user_not_found");
    });
  });
});
