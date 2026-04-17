// Integration tests for service/metrics against a real (in-memory) MongoDB.

const sinon = require("sinon");
const expect = require("chai").expect;

let metrics;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/metrics", function () {
  this.timeout(30000);

  before(async () => {
    metrics = require("../../../service/metrics");
    recognitionCollection = require("../../../database/recognitionCollection");
    goldenRecognitionCollection = require("../../../database/goldenRecognitionCollection");
    deductionCollection = require("../../../database/deductionCollection");
    client = require("../../../database/db");
    await client.connect();
  });

  after(async () => {
    if (client) await client.close();
  });

  beforeEach(async () => {
    await recognitionCollection.deleteMany({});
    await goldenRecognitionCollection.deleteMany({});
    await deductionCollection.deleteMany({});
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createMetricsBlocks", () => {
    it("should encode a chart whose daily bucket totals match the seeded recognitions", async () => {
      const now = new Date();
      await recognitionCollection.insertMany([
        {
          recognizer: "Ugiver1",
          recognizee: "Ureceiver1",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver2",
          recognizee: "Ureceiver2",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver1",
          recognizee: "Ureceiver3",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
      ]);

      const blocks = await metrics.createMetricsBlocks(30);

      expect(blocks[0].block_id).to.equal("metricsHeader");
      expect(blocks[1].block_id).to.equal("metricsGraph");
      expect(blocks[2].block_id).to.equal("metricsTimeRange");
      expect(blocks[2].elements[0].text).to.equal("Last 30 days");
      expect(blocks[3].block_id).to.equal("metricsButtons");

      const imageURL = blocks[1].image_url;
      expect(imageURL).to.match(/^https:\/\/quickchart\.io\/chart\?c=/);

      const encoded = imageURL.split("?c=")[1];
      const chart = JSON.parse(decodeURIComponent(encoded));
      const data = chart.data.datasets[0].data;
      expect(data).to.have.lengthOf(30);
      const total = data.reduce((acc, point) => acc + point.y, 0);
      expect(total).to.equal(3);
    });
  });
});
