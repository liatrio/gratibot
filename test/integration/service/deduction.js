const sinon = require("sinon");
const expect = require("chai").expect;

let deduction;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let deductionLockCollection;
let client;

describe("integration: service/deduction", function () {
  this.timeout(30000);

  before(async () => {
    deduction = require("../../../service/deduction");
    recognitionCollection = require("../../../database/recognitionCollection");
    goldenRecognitionCollection = require("../../../database/goldenRecognitionCollection");
    deductionCollection = require("../../../database/deductionCollection");
    deductionLockCollection = require("../../../database/deductionLockCollection");
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
      deductionLockCollection.deleteMany({}),
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

    it("reports only one of two concurrent refunds as newly refunded", async () => {
      const insertedId = await deduction.createDeduction(
        "Ureceiver",
        5,
        "test reason",
      );

      const results = await Promise.all([
        deduction.refundDeduction(insertedId),
        deduction.refundDeduction(insertedId),
      ]);

      expect(results.map((result) => result.status).sort()).to.deep.equal([
        "already_refunded",
        "refunded",
      ]);
    });

    it("protects a string-id Stadium deduction from generic refund", async () => {
      await deductionCollection.insertOne({
        _id: "stadium:T1:V1",
        source: "stadium",
        status: "fulfilled",
        user: "Ureceiver",
        refund: false,
        value: 5,
      });

      expect(
        (await deduction.refundDeduction("stadium:T1:V1")).status,
      ).to.equal("stadium");
      expect(
        (await deductionCollection.findOne({ _id: "stadium:T1:V1" })).refund,
      ).to.equal(false);
    });
  });

  describe("deduction locks", () => {
    it("serializes a user and atomically reclaims an expired lease", async () => {
      expect(
        (await deduction.acquireLock("Ulocked", "first")).acquired,
      ).to.equal(true);
      expect(
        (await deduction.acquireLock("Ulocked", "second")).acquired,
      ).to.equal(false);

      await deductionLockCollection.updateOne(
        { _id: "Ulocked" },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
      expect(
        (await deduction.acquireLock("Ulocked", "second")).acquired,
      ).to.equal(true);
      const record = await deductionLockCollection.findOne({ _id: "Ulocked" });
      expect(record).to.include({
        operationId: "second",
        kind: "ephemeral",
      });
    });

    it("blocks new deductions while Stadium work needs review", async () => {
      await deductionCollection.insertOne({
        _id: "stadium:T1:V1",
        source: "stadium",
        status: "needs_review",
        user: "Ulocked",
      });

      expect(await deduction.acquireLock("Ulocked", "new")).to.deep.equal({
        acquired: false,
        reason: "stadium-review",
        operationId: "stadium:T1:V1",
      });
      expect(
        await deductionLockCollection.findOne({ _id: "Ulocked" }),
      ).to.equal(null);
    });
  });
});
