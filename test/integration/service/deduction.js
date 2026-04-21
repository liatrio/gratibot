const sinon = require("sinon");
const expect = require("chai").expect;

let deduction;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/deduction", function () {
  this.timeout(30000);

  before(async () => {
    deduction = require("../../../service/deduction");
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
    await Promise.all([
      recognitionCollection.deleteMany({}),
      goldenRecognitionCollection.deleteMany({}),
      deductionCollection.deleteMany({}),
    ]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("isBalanceSufficient", () => {
    it("should return true when the user's balance is at least the deduction value", async () => {
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
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
      ]);

      const sufficient = await deduction.isBalanceSufficient("Ureceiver", 2);
      expect(sufficient).to.equal(true);
    });

    it("should return false when the user's balance is below the deduction value", async () => {
      await recognitionCollection.insertOne({
        recognizer: "Ugiver",
        recognizee: "Ureceiver",
        timestamp: new Date(),
        message: "m",
        channel: "C",
        values: [],
      });

      const sufficient = await deduction.isBalanceSufficient("Ureceiver", 50);
      expect(sufficient).to.equal(false);
    });
  });

  describe("createDeduction", () => {
    it("should insert a deduction record visible via findOne", async () => {
      const insertedId = await deduction.createDeduction(
        "Ureceiver",
        5,
        "test reason",
      );
      expect(insertedId).to.exist;

      const record = await deductionCollection.findOne({ user: "Ureceiver" });
      expect(record).to.include({
        user: "Ureceiver",
        value: 5,
        message: "test reason",
        refund: false,
      });
    });
  });

  describe("refundDeduction", () => {
    it("should flip the refund flag to true on the matching record", async () => {
      const insertedId = await deduction.createDeduction(
        "Ureceiver",
        5,
        "test reason",
      );

      await deduction.refundDeduction(insertedId);

      const record = await deductionCollection.findOne({ user: "Ureceiver" });
      expect(record.refund).to.equal(true);
    });
  });
});
