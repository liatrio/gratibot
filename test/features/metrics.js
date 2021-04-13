const sinon = require("sinon");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const metricsFeature = require("../../features/metrics");
const recognition = require("../../service/recognition");

describe("features/metrics", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    await metricsFeature(controller);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("a metrics request", () => {
    it("should respond with a well-formed metrics message", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.userInput({
        text: "metrics",
      });
      let response = controller.getReplies()[0].response;

      expect(response.blocks[0].block_id).to.equal("metricsHeader");
      expect(response.blocks[1].block_id).to.equal("metricsGraph");
      expect(response.blocks[2].block_id).to.equal("metricsTimeRange");
      expect(response.blocks[3].block_id).to.equal("metricsButtons");
    });

    it("should generate metrics from stored data", async () => {
      let clock = sinon.useFakeTimers(new Date(2020, 1, 1));

      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves([
        {
          timestamp: new Date(2020, 0, 30),
        },
        {
          timestamp: new Date(2020, 0, 15),
        },
        {
          timestamp: new Date(2020, 0, 15),
        },
      ]);

      await controller.userInput({
        text: "metrics",
      });
      clock.restore();

      // TODO: Not sure what to expect here. For now, checks that no error is thrown.
    });
  });
  describe("a metrics interactive button click", () => {
    it("should use data from the selected time range", async () => {
      const getRecognition = sinon
        .stub(recognition, "getPreviousXDaysOfRecognition")
        .resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "metricsButtons",
            value: 365,
          },
        ],
      });

      expect(getRecognition.args[0][1]).to.equal(365);
    });

    it("should display the selected time range", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "metricsButtons",
            value: 365,
          },
        ],
      });
      let response = controller.getReplies()[0].response;

      expect(response.blocks[2].elements[0].text).to.equal("Last 365 days");
    });
  });

  describe("a non-metrics interactive button click", () => {
    it("should be ignored", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "leaderboardButtons",
            value: 365,
          },
        ],
      });

      expect(controller.getReplies()).to.be.empty;
    });
  });
});
