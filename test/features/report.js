const sinon = require("sinon");
const expect = require("chai").expect;

const reportFeature = require("../../features/report");
const report = require("../../service/report");
const { createMockApp } = require("../mocks/bolt-app");

function buildClient({ usersInfoOk = true } = {}) {
  return {
    users: {
      info: sinon.stub().resolves(
        usersInfoOk
          ? {
              ok: true,
              user: { id: "Utarget", tz: "America/Los_Angeles" },
            }
          : { ok: false, error: "user_not_found" },
      ),
    },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
  };
}

function stubReportServiceHappy() {
  sinon.stub(report, "getTopMessagesForUser").resolves([]);
  sinon.stub(report, "getTotalRecognitionsForUser").resolves(0);
  sinon.stub(report, "createUserTopMessagesBlocks").resolves([]);
}

describe("features/report", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToReport", () => {
    it("should default to the caller and 180-day range when no mention or time range is supplied", async () => {
      stubReportServiceHappy();
      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const handler = findHandler(
        "message",
        /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
      );

      const client = buildClient();
      const message = {
        user: "Ucaller",
        text: "report",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(report.getTopMessagesForUser.firstCall.args[0]).to.equal(
        "Ucaller",
      );
      expect(report.getTopMessagesForUser.firstCall.args[1]).to.equal(180);
      expect(report.getTotalRecognitionsForUser.firstCall.args[0]).to.equal(
        "Ucaller",
      );
      expect(report.getTotalRecognitionsForUser.firstCall.args[1]).to.equal(
        180,
      );
    });

    it("should target the mentioned user when <@Uother> appears in the text", async () => {
      stubReportServiceHappy();
      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const handler = findHandler(
        "message",
        /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
      );

      const client = buildClient();
      const message = {
        user: "Ucaller",
        text: "report <@Uother>",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(report.getTopMessagesForUser.firstCall.args[0]).to.equal("Uother");
    });

    it("should parse a trailing integer as the time range", async () => {
      stubReportServiceHappy();
      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const handler = findHandler(
        "message",
        /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
      );

      const client = buildClient();
      const message = {
        user: "Ucaller",
        text: "report 30",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(report.getTopMessagesForUser.firstCall.args[1]).to.equal(30);
      expect(report.getTotalRecognitionsForUser.firstCall.args[1]).to.equal(30);
    });

    it("should post the generic error text when users.info returns ok: false", async () => {
      const getTopStub = sinon.stub(report, "getTopMessagesForUser");
      sinon.stub(report, "getTotalRecognitionsForUser").resolves(0);
      sinon.stub(report, "createUserTopMessagesBlocks").resolves([]);

      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const handler = findHandler(
        "message",
        /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
      );

      const client = buildClient({ usersInfoOk: false });
      const message = {
        user: "Ucaller",
        text: "report",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(getTopStub.called).to.equal(false);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      expect(client.chat.postMessage.firstCall.args[0].text).to.include(
        "An unexpected error occurred while generating the report",
      );
    });

    it("should post the generic error text when getTopMessagesForUser rejects", async () => {
      sinon
        .stub(report, "getTopMessagesForUser")
        .rejects(new Error("aggregate boom"));
      sinon.stub(report, "getTotalRecognitionsForUser").resolves(0);
      sinon.stub(report, "createUserTopMessagesBlocks").resolves([]);

      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const handler = findHandler(
        "message",
        /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
      );

      const client = buildClient();
      const message = {
        user: "Ucaller",
        text: "report",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(client.chat.postMessage.calledOnce).to.equal(true);
      expect(client.chat.postMessage.firstCall.args[0].text).to.include(
        "An unexpected error occurred while generating the report",
      );
    });
  });

  describe("updateReportTimeRange", () => {
    it("should ack, fetch fresh data, and respond with the new blocks on the happy path", async () => {
      const fakeBlocks = [{ type: "section" }];
      sinon.stub(report, "getTopMessagesForUser").resolves([]);
      sinon.stub(report, "getTotalRecognitionsForUser").resolves(3);
      sinon.stub(report, "createUserTopMessagesBlocks").resolves(fakeBlocks);

      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const actionHandler = findHandler("action", /user-top-messages-\d+/);

      const ack = sinon.stub().resolves();
      const respond = sinon.stub().resolves();
      const client = buildClient();
      const body = { user: { id: "Ucaller" } };
      const action = { value: "Uother:30" };

      await actionHandler({ ack, body, client, action, respond });

      expect(ack.calledOnce).to.equal(true);
      expect(report.getTopMessagesForUser.firstCall.args[0]).to.equal("Uother");
      expect(report.getTopMessagesForUser.firstCall.args[1]).to.equal(30);
      expect(respond.calledOnce).to.equal(true);
      const args = respond.firstCall.args[0];
      expect(args.text).to.include("<@Uother>");
      expect(args.blocks).to.equal(fakeBlocks);
    });

    it("should respond with a 'Something went wrong' message and replace_original:false when users.info rejects", async () => {
      const getTopStub = sinon.stub(report, "getTopMessagesForUser");

      const { app, findHandler } = createMockApp();
      reportFeature(app);
      const actionHandler = findHandler("action", /user-top-messages-\d+/);

      const ack = sinon.stub().resolves();
      const respond = sinon.stub().resolves();
      const client = {
        users: { info: sinon.stub().rejects(new Error("slack down")) },
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
      };
      const body = { user: { id: "Ucaller" } };
      const action = { value: "Uother:30" };

      await actionHandler({ ack, body, client, action, respond });

      expect(getTopStub.called).to.equal(false);
      expect(respond.calledOnce).to.equal(true);
      const args = respond.firstCall.args[0];
      expect(args.text).to.include(
        "Something went wrong while updating the report",
      );
      expect(args.replace_original).to.equal(false);
    });
  });
});
