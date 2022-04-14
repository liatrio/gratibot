const sinon = require("sinon");
const expect = require("chai").expect;

const metrics = require("../../service/metrics");
const recognition = require("../../service/recognition");

describe("service/metrics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("createMetricsBlocks", () => {
    it("should respond with a well-formed metrics message", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      const result = await metrics.createMetricsBlocks(30);

      expect(result[0].block_id).to.equal("metricsHeader");
      expect(result[1].block_id).to.equal("metricsGraph");
      expect(result[2].block_id).to.equal("metricsTimeRange");
      expect(result[3].block_id).to.equal("metricsButtons");
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

      await metrics.createMetricsBlocks(30);
      clock.restore();

      // TODO: Not sure what to expect here. For now, checks that no error is thrown.
    });

    it("should display the selected time range", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      const result = await metrics.createMetricsBlocks(365);

      expect(result[2].elements[0].text).to.equal("Last 365 days");
    });
  });
});
