const sinon = require("sinon");
const expect = require("chai").expect;

const deductionFeature = require("../../features/deduction");
const deduction = require("../../service/deduction");
const config = require("../../config");
const { createMockApp } = require("../mocks/bolt-app");

function buildClient() {
  return {
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
}

// The feature destructures `redemptionAdmins` at module-load time, so we must
// mutate the existing array reference in place (not replace the config
// property) for the stubbed admin list to be visible inside the handler.
function setAdmins(admins) {
  config.redemptionAdmins.length = 0;
  config.redemptionAdmins.push(...admins);
}

describe("features/deduction", () => {
  let originalAdmins;

  beforeEach(function () {
    originalAdmins = [...config.redemptionAdmins];
  });

  afterEach(function () {
    sinon.restore();
    setAdmins(originalAdmins);
  });

  describe("respondToDeduction", () => {
    it("should post an error message when users.info returns ok: false", async () => {
      const { app, findHandler } = createMockApp();
      deductionFeature(app);
      const handler = findHandler("message", /deduct/i);

      const client = buildClient();
      client.users.info = sinon
        .stub()
        .resolves({ ok: false, error: "user_not_found" });
      const isBalanceSufficentStub = sinon.stub(
        deduction,
        "isBalanceSufficent",
      );

      const message = {
        user: "Uadmin",
        text: "<@Ugratibot> deduct <@Uother> 5",
        channel: "Ddm",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(isBalanceSufficentStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.include(
        "Something went wrong while creating your deduction",
      );
      expect(args.text).to.include("user_not_found");
    });

    it("should reject a caller not in config.redemptionAdmins with a not-allowed message", async () => {
      setAdmins(["Uadmin"]);
      const { app, findHandler } = createMockApp();
      deductionFeature(app);
      const handler = findHandler("message", /deduct/i);

      const client = buildClient();
      const isBalanceSufficentStub = sinon.stub(
        deduction,
        "isBalanceSufficent",
      );
      const message = {
        user: "Unotadmin",
        text: "<@Ugratibot> deduct <@Uother> 5",
        channel: "Ddm",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(isBalanceSufficentStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      expect(client.chat.postMessage.firstCall.args[0].text).to.include(
        "You are not allowed to create deductions",
      );
    });

    it("should post the usage hint when the deduct command is malformed", async () => {
      setAdmins(["Uadmin"]);
      const { app, findHandler } = createMockApp();
      deductionFeature(app);
      const handler = findHandler("message", /deduct/i);

      const client = buildClient();
      const isBalanceSufficentStub = sinon.stub(
        deduction,
        "isBalanceSufficent",
      );

      // Too few tokens (3)
      await handler({
        message: {
          user: "Uadmin",
          text: "<@Ugratibot> deduct <@Uother>",
          channel: "Ddm",
          channel_type: "im",
        },
        client,
      });

      // Bad user regex at index 2
      await handler({
        message: {
          user: "Uadmin",
          text: "<@Ugratibot> deduct notauser 5",
          channel: "Ddm",
          channel_type: "im",
        },
        client,
      });

      // Non-numeric value at index 3
      await handler({
        message: {
          user: "Uadmin",
          text: "<@Ugratibot> deduct <@Uother> notanumber",
          channel: "Ddm",
          channel_type: "im",
        },
        client,
      });

      expect(isBalanceSufficentStub.called).to.equal(false);
      expect(client.chat.postMessage.callCount).to.equal(3);
      client.chat.postMessage.getCalls().forEach((call) => {
        expect(call.args[0].text).to.include(
          "You must specify a user and value to deduct",
        );
      });
    });

    it("should post an insufficient-balance message when deduction.isBalanceSufficent returns false", async () => {
      setAdmins(["Uadmin"]);
      const { app, findHandler } = createMockApp();
      deductionFeature(app);
      const handler = findHandler("message", /deduct/i);

      sinon.stub(deduction, "isBalanceSufficent").resolves(false);
      const createDeductionStub = sinon.stub(deduction, "createDeduction");

      const client = buildClient();
      const message = {
        user: "Uadmin",
        text: "<@Ugratibot> deduct <@Uother> 5",
        channel: "Ddm",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(createDeductionStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      expect(client.chat.postMessage.firstCall.args[0].text).to.include(
        "does not have a large enough balance to deduct 5 fistbumps",
      );
    });

    it("should post a confirmation with the deduction ID on the happy path", async () => {
      setAdmins(["Uadmin"]);
      const { app, findHandler } = createMockApp();
      deductionFeature(app);
      const handler = findHandler("message", /deduct/i);

      sinon.stub(deduction, "isBalanceSufficent").resolves(true);
      sinon
        .stub(deduction, "createDeduction")
        .resolves({ _id: "DEDUCTION-123" });

      const client = buildClient();
      const message = {
        user: "Uadmin",
        text: "<@Ugratibot> deduct <@Uother> 5",
        channel: "Cchannel",
        channel_type: "channel",
      };

      await handler({ message, client });

      expect(deduction.createDeduction.calledOnce).to.equal(true);
      expect(deduction.createDeduction.firstCall.args[0]).to.equal("Uother");
      expect(deduction.createDeduction.firstCall.args[1]).to.equal(5);

      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.channel).to.equal("Cchannel");
      expect(args.text).to.include(
        "A deduction of 5 fistbumps has been made for <@Uother>",
      );
      expect(args.text).to.include("DEDUCTION-123");
    });
  });
});
