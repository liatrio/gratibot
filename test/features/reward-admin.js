const sinon = require("sinon");
const expect = require("chai").expect;

const rewardAdminFeature = require("../../features/reward-admin");
const rewardAdmin = require("../../service/rewardAdmin");
const { createMockApp } = require("../mocks/bolt-app");

const ADMIN_MATCHER = /^\s*admin\s*$/i;

function buildClient() {
  return {
    views: {
      open: sinon.stub().resolves({ ok: true }),
      update: sinon.stub().resolves({ ok: true }),
    },
  };
}

describe("features/reward-admin", function () {
  afterEach(function () {
    sinon.restore();
  });

  describe("handleAdmin", function () {
    it("replies with the no-admin-access message and does not open a modal when the user has no admin roles", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("message", ADMIN_MATCHER);

      sinon.stub(rewardAdmin, "isAuthorized").returns(false);
      const listStub = sinon.stub(rewardAdmin, "listRewards").resolves([]);

      const client = buildClient();
      const say = sinon.stub().resolves();
      const message = {
        user: "Uouter",
        text: "admin",
        channel: "Ddm",
        channel_type: "im",
      };

      await handler({
        message,
        body: { trigger_id: "T1" },
        client,
        say,
      });

      expect(say.calledOnce).to.equal(true);
      expect(say.firstCall.args[0]).to.equal("You do not have admin access.");
      expect(client.views.open.called).to.equal(false);
      expect(listStub.called).to.equal(false);
    });

    it("replies with a 'Manage Rewards' button for a redemption admin (message events have no trigger_id)", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("message", ADMIN_MATCHER);

      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      const listStub = sinon.stub(rewardAdmin, "listRewards").resolves([]);
      const buildStub = sinon.stub(rewardAdmin, "buildMainView").returns({});

      const client = buildClient();
      const say = sinon.stub().resolves();

      await handler({
        message: { user: "Uadmin", text: "admin", channel_type: "im" },
        body: {},
        client,
        say,
      });

      expect(client.views.open.called).to.equal(false);
      expect(listStub.called).to.equal(false);
      expect(buildStub.called).to.equal(false);
      expect(say.calledOnce).to.equal(true);
      const arg = say.firstCall.args[0];
      expect(arg.text).to.equal("Admin controls");
      expect(arg.blocks).to.be.an("array").with.lengthOf(1);
      expect(arg.blocks[0].type).to.equal("actions");
      const button = arg.blocks[0].elements[0];
      expect(button.type).to.equal("button");
      expect(button.text.text).to.equal("Manage Rewards");
      expect(button.action_id).to.equal("reward_admin_open");
    });
  });

  describe("admin matcher", function () {
    it("matches plain 'admin'", function () {
      expect(ADMIN_MATCHER.test("admin")).to.equal(true);
    });

    it("matches 'ADMIN' (case-insensitive)", function () {
      expect(ADMIN_MATCHER.test("ADMIN")).to.equal(true);
    });

    it("matches '  admin  ' (whitespace-tolerant)", function () {
      expect(ADMIN_MATCHER.test("  admin  ")).to.equal(true);
    });

    it("does NOT match 'admin redeem'", function () {
      expect(ADMIN_MATCHER.test("admin redeem")).to.equal(false);
    });

    it("does NOT match 'administrate'", function () {
      expect(ADMIN_MATCHER.test("administrate")).to.equal(false);
    });
  });

  describe("reward_admin_open action", function () {
    it("opens the main modal view using the action's trigger_id", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("action", "reward_admin_open");

      const rewards = [
        { _id: "R1", name: "Alpha", cost: 5, active: true, sortOrder: 0 },
      ];
      const fakeView = { type: "modal", callback_id: "reward_admin_main" };
      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      sinon.stub(rewardAdmin, "listRewards").resolves(rewards);
      const buildStub = sinon
        .stub(rewardAdmin, "buildMainView")
        .returns(fakeView);

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uadmin" }, trigger_id: "T-trig" },
        client,
      });

      expect(ack.calledOnce).to.equal(true);
      expect(buildStub.calledWith(rewards)).to.equal(true);
      expect(client.views.open.calledOnce).to.equal(true);
      const args = client.views.open.firstCall.args[0];
      expect(args.trigger_id).to.equal("T-trig");
      expect(args.view).to.equal(fakeView);
    });

    it("responds with the not-authorized message and does not open the modal for a non-admin", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("action", "reward_admin_open");

      sinon.stub(rewardAdmin, "isAuthorized").returns(false);
      const listStub = sinon.stub(rewardAdmin, "listRewards").resolves([]);

      const client = buildClient();
      const ack = sinon.stub().resolves();
      const respond = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uouter" }, trigger_id: "T-trig" },
        client,
        respond,
      });

      expect(ack.calledOnce).to.equal(true);
      expect(client.views.open.called).to.equal(false);
      expect(listStub.called).to.equal(false);
      expect(respond.calledOnce).to.equal(true);
      const arg = respond.firstCall.args[0];
      expect(arg.text).to.equal("You are not authorized to manage rewards.");
      expect(arg.response_type).to.equal("ephemeral");
    });
  });

  describe("reward_admin_add action", function () {
    it("updates the modal with the Add view for an admin", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("action", "reward_admin_add");

      const fakeView = {
        type: "modal",
        callback_id: "reward_admin_add_submit",
      };
      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      const buildStub = sinon
        .stub(rewardAdmin, "buildAddView")
        .returns(fakeView);

      const client = buildClient();
      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: {
          user: { id: "Uadmin" },
          view: { id: "V1", hash: "H1" },
        },
        client,
      });

      expect(ack.calledOnce).to.equal(true);
      expect(buildStub.calledOnce).to.equal(true);
      expect(client.views.update.calledOnce).to.equal(true);
      const args = client.views.update.firstCall.args[0];
      expect(args.view_id).to.equal("V1");
      expect(args.hash).to.equal("H1");
      expect(args.view).to.equal(fakeView);
    });
  });

  describe("reward_admin_add_submit view_submission", function () {
    it("re-checks authorization and rejects a non-admin replay", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("view", "reward_admin_add_submit");

      sinon.stub(rewardAdmin, "isAuthorized").returns(false);
      const createStub = sinon.stub(rewardAdmin, "createReward").resolves({});
      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uouter" } },
        view: { state: { values: {} } },
      });

      expect(createStub.called).to.equal(false);
      expect(ack.calledOnce).to.equal(true);
      const ackArg = ack.firstCall.args[0];
      expect(ackArg.response_action).to.equal("errors");
      expect(ackArg.errors).to.have.property("name");
    });

    it("calls createReward and acks with response_action: 'update' on the happy path", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("view", "reward_admin_add_submit");

      const parsed = {
        name: "Widget",
        description: "A widget",
        cost: 15,
        sortOrder: 2,
        imageURL: "https://example.com/w.png",
        active: true,
      };
      const rewards = [{ _id: "R1", name: "Widget" }];
      const fakeMainView = { type: "modal", callback_id: "reward_admin_main" };

      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      sinon.stub(rewardAdmin, "parseViewSubmission").returns(parsed);
      sinon.stub(rewardAdmin, "validateReward").returns({ ok: true });
      const createStub = sinon.stub(rewardAdmin, "createReward").resolves({});
      sinon.stub(rewardAdmin, "listRewards").resolves(rewards);
      sinon.stub(rewardAdmin, "buildMainView").returns(fakeMainView);

      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uadmin" } },
        view: { state: { values: {} } },
      });

      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal(parsed);
      expect(createStub.firstCall.args[1]).to.equal("Uadmin");
      expect(ack.calledOnce).to.equal(true);
      const ackArg = ack.firstCall.args[0];
      expect(ackArg.response_action).to.equal("update");
      expect(ackArg.view).to.equal(fakeMainView);
    });

    it("acks with response_action: 'errors' when validation fails", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("view", "reward_admin_add_submit");

      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      sinon
        .stub(rewardAdmin, "parseViewSubmission")
        .returns({ name: "", description: "", cost: -1 });
      sinon.stub(rewardAdmin, "validateReward").returns({
        ok: false,
        errors: { name: "Name is required." },
      });
      const createStub = sinon.stub(rewardAdmin, "createReward").resolves({});

      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uadmin" } },
        view: { state: { values: {} } },
      });

      expect(createStub.called).to.equal(false);
      const ackArg = ack.firstCall.args[0];
      expect(ackArg.response_action).to.equal("errors");
      expect(ackArg.errors).to.deep.equal({ name: "Name is required." });
    });
  });

  describe("reward_admin_edit_submit view_submission", function () {
    it("calls updateReward with the _id from private_metadata on the happy path", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("view", "reward_admin_edit_submit");

      const parsed = {
        name: "Updated Widget",
        description: "An updated widget",
        cost: 20,
        sortOrder: 1,
        imageURL: "https://example.com/w.png",
        active: true,
      };
      const fakeMainView = { type: "modal", callback_id: "reward_admin_main" };

      sinon.stub(rewardAdmin, "isAuthorized").returns(true);
      sinon.stub(rewardAdmin, "parseViewSubmission").returns(parsed);
      sinon.stub(rewardAdmin, "validateReward").returns({ ok: true });
      const updateStub = sinon.stub(rewardAdmin, "updateReward").resolves({});
      sinon.stub(rewardAdmin, "listRewards").resolves([]);
      sinon.stub(rewardAdmin, "buildMainView").returns(fakeMainView);

      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uadmin" } },
        view: {
          state: { values: {} },
          private_metadata: "REWARDID",
        },
      });

      expect(updateStub.calledOnce).to.equal(true);
      expect(updateStub.firstCall.args[0]).to.equal("REWARDID");
      expect(updateStub.firstCall.args[1]).to.deep.equal(parsed);
      expect(updateStub.firstCall.args[2]).to.equal("Uadmin");
      expect(ack.firstCall.args[0].response_action).to.equal("update");
    });

    it("re-checks authorization and rejects a non-admin replay", async function () {
      const { app, findHandler } = createMockApp();
      rewardAdminFeature(app);
      const handler = findHandler("view", "reward_admin_edit_submit");

      sinon.stub(rewardAdmin, "isAuthorized").returns(false);
      const updateStub = sinon.stub(rewardAdmin, "updateReward").resolves({});
      const ack = sinon.stub().resolves();

      await handler({
        ack,
        body: { user: { id: "Uouter" } },
        view: { state: { values: {} }, private_metadata: "REWARDID" },
      });

      expect(updateStub.called).to.equal(false);
      expect(ack.firstCall.args[0].response_action).to.equal("errors");
    });
  });
});
