// Integration tests for service/balance against a real (in-memory) MongoDB.
//
// Requires for service/database modules live inside before() so they run
// AFTER the root beforeAll in test/integration/setup.js has set MONGO_URL.
// If they were at the top of the file, database/db.js would instantiate a
// MongoClient pointing at the default URL before the memory server is ready.

const sinon = require("sinon");
const expect = require("chai").expect;
const moment = require("moment-timezone");

let balance;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/balance", function () {
  this.timeout(30000);

  before(async () => {
    balance = require("../../../service/balance");
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

  describe("dailyGratitudeRemaining", () => {
    it("should count only today's recognitions from the given user in the given timezone and subtract from the daily maximum", async () => {
      sinon.stub(require("../../../config"), "maximum").value(5);

      // Compute "today" boundaries in Pacific time using real wall clock so
      // the $gte filter behavior can be asserted without freezing timers
      // (which can hang the memory server's internal connection heartbeats).
      const tz = "America/Los_Angeles";
      const midnightPT = moment().tz(tz).startOf("day").toDate();
      const beforeMidnight = new Date(midnightPT.getTime() - 60 * 60 * 1000);
      const afterMidnight = new Date(midnightPT.getTime() + 60 * 60 * 1000);

      await recognitionCollection.insertMany([
        // Two recognitions from Ugiver today — both should count.
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: afterMidnight,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: afterMidnight,
          message: "m",
          channel: "C",
          values: [],
        },
        // Yesterday — should be excluded by the $gte filter.
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: beforeMidnight,
          message: "m",
          channel: "C",
          values: [],
        },
        // Today but a different giver — should not count against Ugiver.
        {
          recognizer: "Uother",
          recognizee: "Ureceiver",
          timestamp: afterMidnight,
          message: "m",
          channel: "C",
          values: [],
        },
      ]);

      const remaining = await balance.dailyGratitudeRemaining("Ugiver", tz);

      // Two of Ugiver's recognitions fall in today's PT window. 5 - 2 = 3.
      expect(remaining).to.equal(3);
    });
  });

  describe("currentBalance", () => {
    it("should sum recognitions received, golden recognitions times twenty, minus non-refunded deductions", async () => {
      await recognitionCollection.insertMany([
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
        // A recognition for a different user — should be excluded.
        {
          recognizer: "Ugiver",
          recognizee: "Uother",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
      ]);
      await goldenRecognitionCollection.insertOne({
        recognizer: "Uprev",
        recognizee: "Ureceiver",
        timestamp: new Date(),
        message: "m",
        channel: "C",
        values: [],
      });
      await deductionCollection.insertMany([
        { user: "Ureceiver", value: 5, refund: false },
        { user: "Ureceiver", value: 3, refund: false },
        // A refunded deduction — should be excluded from spending.
        { user: "Ureceiver", value: 100, refund: true },
      ]);

      const result = await balance.currentBalance("Ureceiver");

      // 2 recognitions + 1 golden*20 - 8 in deductions = 14
      expect(result).to.equal(14);
    });
  });
});
