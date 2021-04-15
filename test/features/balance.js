const sinon = require("sinon");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const balanceFeature = require("../../features/balance");
const balance = require("../../service/balance");
const config = require("../../config");

describe("features/balance", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    controller.bot.api.users.info
      .withArgs({ user: "Requester" })
      .resolves({
        ok: true,
        user: {
          id: "Requester",
          tz: "America/Los_Angeles",
        },
      })
      .withArgs({ user: "NotARealUser" })
      .resolves({
        ok: false,
        error: "user_not_found",
      });

    await balanceFeature(controller);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("a balance request", () => {
    it("should respond with the requester's balance", async () => {
      sinon.stub(balance, "currentBalance").resolves(10);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);

      await controller.userInput({
        text: "balance",
        user: "Requester",
      });
      let response = controller.getReplies()[0].response;

      expect(response).to.include("Your current balance is: `10`");
    });

    it("should respond with the requester's lifetime total", async () => {
      sinon.stub(balance, "currentBalance").resolves(10);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);

      await controller.userInput({
        text: "balance",
        user: "Requester",
      });
      let response = controller.getReplies()[0].response;

      expect(response).to.include("Your lifetime earnings are: `100`");
    });

    it("should respond with the requester's remaining daily gratitude", async () => {
      sinon.stub(balance, "currentBalance").resolves(10);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);

      await controller.userInput({
        text: "balance",
        user: "Requester",
      });
      let response = controller.getReplies()[0].response;

      expect(response).to.include("You have `5` left to give away today.");
    });

    it("should handle Slack API errors", async () => {
      sinon.stub(balance, "currentBalance").resolves(10);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);

      await controller.userInput({
        text: "balance",
        user: "NotARealUser",
      });
      let response = controller.getReplies()[0].response;

      expect(response).to.include(
        "Something went wrong while obtaining your balance."
      );
    });

    it("should tell users if they have unlimited daily gratitude", async () => {
      sinon.stub(balance, "currentBalance").resolves(10);
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(0);
      sinon.stub(config, "usersExemptFromMaximum").value(["Requester"]);

      await controller.userInput({
        text: "balance",
        user: "Requester",
      });
      let response = controller.getReplies()[0].response;

      expect(response).to.not.include("You have `0` left to give away today.");
      expect(response).to.include(
        "You have no daily limit, you can give as many :fistbump: as you like."
      );
    });
  });
});
