const sinon = require("sinon");
const expect = require("chai").expect;

const config = require("../../config");
const balance = require("../../service/balance");
const recognitionCollection = require("../../database/recognitionCollection");
const goldenRecognitionCollection = require("../../database/goldenRecognitionCollection");
const deductionCollection = require("../../database/deductionCollection");

describe("service/balance", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("dailyGratitudeRemaining", () => {
    it("should return Infinity for exempt users", async () => {
      sinon.stub(config, "usersExemptFromMaximum").value(["ExemptUser"]);

      const result = await balance.dailyGratitudeRemaining(
        "ExemptUser",
        "America/Los_Angeles",
      );

      expect(result).to.equal(Infinity);
    });

    it("should allow for configurable maximum", async () => {
      sinon.stub(config, "maximum").value(10);
      sinon.stub(recognitionCollection, "countDocuments").resolves(1);

      const result = await balance.dailyGratitudeRemaining(
        "User",
        "America/Los_Angeles",
      );

      expect(result).to.equal(9);
    });
  });

  describe("dailySelfRecognitionRemaining", () => {
    it("should return the configured maximum when no self-fistbump has been given today", async () => {
      sinon.stub(config, "selfRecognitionMaximum").value(1);
      sinon.stub(recognitionCollection, "countDocuments").resolves(0);

      const result = await balance.dailySelfRecognitionRemaining(
        "User",
        "America/Los_Angeles",
      );

      expect(result).to.equal(1);
    });

    it("should return zero once the daily self-fistbump has been used", async () => {
      sinon.stub(config, "selfRecognitionMaximum").value(1);
      sinon.stub(recognitionCollection, "countDocuments").resolves(1);

      const result = await balance.dailySelfRecognitionRemaining(
        "User",
        "America/Los_Angeles",
      );

      expect(result).to.equal(0);
    });

    it("should only count today's self-recognitions (recognizer === recognizee)", async () => {
      const count = sinon
        .stub(recognitionCollection, "countDocuments")
        .resolves(0);
      sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1)));

      await balance.dailySelfRecognitionRemaining(
        "User",
        "America/Los_Angeles",
      );

      const filter = count.args[0][0];
      expect(filter.recognizer).to.equal("User");
      expect(filter.recognizee).to.equal("User");
      expect(filter.timestamp).to.have.property("$gte");
    });
  });

  describe("currentBalance", () => {
    it("should return total earnings when users have no deductions", async () => {
      sinon.stub(recognitionCollection, "countDocuments").resolves(100);
      sinon.stub(goldenRecognitionCollection, "countDocuments").resolves(0);
      sinon
        .stub(deductionCollection, "find")
        .returns({ toArray: sinon.stub().resolves([]) });

      const result = await balance.currentBalance("User");

      expect(result).to.equal(100);
    });

    it("should return total earnings when users have no deductions and has received golden fistbumps", async () => {
      sinon.stub(recognitionCollection, "countDocuments").resolves(100);
      sinon.stub(goldenRecognitionCollection, "countDocuments").resolves(4);
      sinon
        .stub(deductionCollection, "find")
        .returns({ toArray: sinon.stub().resolves([]) });

      const result = await balance.currentBalance("User");

      expect(result).to.equal(180);
    });
  });

  describe("lifetimeSpendings", () => {
    it("should sum the total deduction value returned from the db", async () => {
      sinon.stub(deductionCollection, "find").returns({
        toArray: sinon.stub().resolves([
          {
            user: "User",
            value: 10,
          },
          {
            user: "User",
            value: 10,
          },
        ]),
      });

      const result = await balance.lifetimeSpendings("User");

      expect(result).to.equal(20);
    });
  });
});
