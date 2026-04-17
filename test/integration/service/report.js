// Integration tests for service/report against a real (in-memory) MongoDB.

const sinon = require("sinon");
const expect = require("chai").expect;
const moment = require("moment-timezone");

let report;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/report", function () {
  this.timeout(30000);

  before(async () => {
    report = require("../../../service/report");
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

  describe("getTopMessagesForUser", () => {
    it("should group by message and return entries sorted by count desc with MMM D, YYYY formatted dates", async () => {
      // Use a fixed timestamp inside the 30-day window so formattedDate is
      // deterministic. Choose a date 3 days before now in the target
      // timezone so the $gte filter keeps the record.
      const tz = "America/Los_Angeles";
      const seededMoment = moment().tz(tz).subtract(3, "days");
      const seededDate = seededMoment.toDate();
      const expectedFormatted = seededMoment.format("MMM D, YYYY");

      await recognitionCollection.insertMany([
        {
          recognizer: "U1",
          recognizee: "Ureceiver",
          timestamp: seededDate,
          message: "great work",
          channel: "C1",
          values: [],
        },
        {
          recognizer: "U2",
          recognizee: "Ureceiver",
          timestamp: seededDate,
          message: "great work",
          channel: "C1",
          values: [],
        },
        {
          recognizer: "U3",
          recognizee: "Ureceiver",
          timestamp: seededDate,
          message: "great work",
          channel: "C1",
          values: [],
        },
        {
          recognizer: "U1",
          recognizee: "Ureceiver",
          timestamp: seededDate,
          message: "awesome",
          channel: "C2",
          values: [],
        },
        {
          recognizer: "U2",
          recognizee: "Ureceiver",
          timestamp: seededDate,
          message: "nice",
          channel: "C3",
          values: [],
        },
      ]);

      const result = await report.getTopMessagesForUser("Ureceiver", 30, tz);

      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.include({
        message: "great work",
        count: 3,
        channel: "C1",
        formattedDate: expectedFormatted,
      });
      expect(result[0].recognizers).to.have.members(["U1", "U2", "U3"]);
      expect(result.map((r) => r.count)).to.deep.equal([3, 1, 1]);
    });

    it("should return an empty array when the user has no recognitions in the time window", async () => {
      const result = await report.getTopMessagesForUser(
        "Uempty",
        30,
        "America/Los_Angeles",
      );
      expect(result).to.deep.equal([]);
    });
  });

  describe("getTotalRecognitionsForUser", () => {
    it("should return the total count of recognitions for the given user within the time window", async () => {
      const tz = "America/Los_Angeles";
      const within = moment().tz(tz).subtract(3, "days").toDate();
      await recognitionCollection.insertMany([
        {
          recognizer: "U1",
          recognizee: "Ureceiver",
          timestamp: within,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "U2",
          recognizee: "Ureceiver",
          timestamp: within,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "U1",
          recognizee: "Uother",
          timestamp: within,
          message: "m",
          channel: "C",
          values: [],
        },
      ]);

      const count = await report.getTotalRecognitionsForUser(
        "Ureceiver",
        30,
        tz,
      );

      expect(count).to.equal(2);
    });
  });
});
