const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// create mocks
const mockWinston = {
  info: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub(),
};
const mockScheduleJob = sinon.stub();
const mockScheduler = { scheduleJob: mockScheduleJob };
const mockPostFistbumpReport = sinon.stub().resolves(true);
const mockFistbumpReport = { postFistbumpReport: mockPostFistbumpReport };

describe("scheduled-report feature", () => {
  // mocks and stubs
  let mockApp;
  let scheduledReportModule;
  let commandHandler;

  beforeEach(() => {
    // reset all stubs
    sinon.reset();

    // setup mock app
    mockApp = {
      client: { chat: { postMessage: sinon.stub() } },
      command: sinon.stub(),
    };

    // create feature module with mocked dependencies
    scheduledReportModule = proxyquire("../../features/scheduled-report", {
      "../winston": mockWinston,
      "../service/scheduler": mockScheduler,
      "../service/fistbumpReport": mockFistbumpReport,
    });

    // initialize module with mock app
    scheduledReportModule(mockApp);
  });

  it("should initialize weekly report scheduler on startup", () => {
    // assert
    expect(mockScheduleJob.calledOnce).to.be.true;
    expect(mockScheduleJob.firstCall.args[0]).to.equal(
      "weekly-fistbump-report",
    );
    // cron expression for Monday at 9 AM
    expect(mockScheduleJob.firstCall.args[1]).to.equal("0 0 9 * * 1");
    expect(mockWinston.info.calledOnce).to.be.true;
  });

  it("should register the slash command handler", () => {
    // assert
    expect(mockApp.command.calledOnce).to.be.true;
    expect(mockApp.command.firstCall.args[0]).to.equal(
      "/gratibot-schedule-report",
    );
    expect(typeof mockApp.command.firstCall.args[1]).to.equal("function");
  });

  describe("handleScheduleCommand", () => {
    // test data
    let mockRespond;
    let mockAck;
    let mockClient;

    beforeEach(() => {
      // Reset stubs
      sinon.reset();

      // Setup test mocks
      mockRespond = sinon.stub().resolves();
      mockAck = sinon.stub().resolves();
      mockClient = {
        users: {
          info: sinon.stub().resolves({ user: { is_admin: true } }),
        },
      };

      // Get the command handler that was registered
      commandHandler = mockApp.command.firstCall.args[1];
    });

    it("should require admin permissions", async () => {
      // arrange
      mockClient.users.info.resolves({ user: { is_admin: false } });
      const command = {
        channel_id: "C12345",
        text: "enable 7",
        user_id: "U12345",
      };

      // act
      await commandHandler({
        command,
        ack: mockAck,
        respond: mockRespond,
        client: mockClient,
      });

      // assert
      expect(mockAck.calledOnce).to.be.true;
      expect(mockClient.users.info.calledOnceWith({ user: "U12345" })).to.be
        .true;
      expect(mockRespond.calledOnce).to.be.true;
      expect(mockRespond.firstCall.args[0].text).to.include(
        "need to be a workspace admin",
      );
    });

    it("should handle enable subcommand", async () => {
      // arrange
      mockClient.users.info.resolves({ user: { is_admin: true } });
      const command = {
        channel_id: "C12345",
        text: "enable 14",
        user_id: "U12345",
      };

      // act
      await commandHandler({
        command,
        ack: mockAck,
        respond: mockRespond,
        client: mockClient,
      });

      // assert
      expect(mockAck.calledOnce).to.be.true;
      expect(mockRespond.calledOnce).to.be.true;
      expect(mockRespond.firstCall.args[0].text).to.include("enabled");
      expect(mockRespond.firstCall.args[0].text).to.include("14");
      expect(mockWinston.info.calledOnce).to.be.true;
    });

    it("should handle disable subcommand", async () => {
      // arrange
      mockClient.users.info.resolves({ user: { is_admin: true } });
      const command = {
        channel_id: "C12345",
        text: "disable",
        user_id: "U12345",
      };

      // act
      await commandHandler({
        command,
        ack: mockAck,
        respond: mockRespond,
        client: mockClient,
      });

      // assert
      expect(mockAck.calledOnce).to.be.true;
      expect(mockRespond.calledOnce).to.be.true;
      expect(mockRespond.firstCall.args[0].text).to.include("disabled");
      expect(mockWinston.info.calledOnce).to.be.true;
    });

    it("should handle preview subcommand", async () => {
      // arrange
      mockClient.users.info.resolves({ user: { is_admin: true } });
      const command = {
        channel_id: "C12345",
        text: "preview 30",
        user_id: "U12345",
      };

      // act
      await commandHandler({
        command,
        ack: mockAck,
        respond: mockRespond,
        client: mockClient,
      });

      // assert
      expect(mockAck.calledOnce).to.be.true;
      expect(mockRespond.calledOnce).to.be.true;
      expect(mockRespond.firstCall.args[0].text).to.include("preview");
      expect(mockPostFistbumpReport.calledOnceWith(mockClient, "C12345", 30)).to
        .be.true;
      expect(mockWinston.info.calledOnce).to.be.true;
    });

    it("should show help for unknown commands", async () => {
      // arrange
      mockClient.users.info.resolves({ user: { is_admin: true } });
      const command = {
        channel_id: "C12345",
        text: "unknown",
        user_id: "U12345",
      };

      // act
      await commandHandler({
        command,
        ack: mockAck,
        respond: mockRespond,
        client: mockClient,
      });

      // assert
      expect(mockAck.calledOnce).to.be.true;
      expect(mockRespond.calledOnce).to.be.true;
      expect(mockRespond.firstCall.args[0].text).to.include("help");
      expect(mockRespond.firstCall.args[0].text).to.include(
        "Available commands",
      );
    });
  });
});
