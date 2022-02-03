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
        "America/Los_Angeles"
      );

      expect(result).to.equal(Infinity);
    });
    it("should allow for configurable maximum", async () => {
      sinon.stub(config, "maximum").value(10);
      sinon.stub(recognitionCollection, "count").resolves(1);

      const result = await balance.dailyGratitudeRemaining(
        "User",
        "America/Los_Angeles"
      );

      expect(result).to.equal(9);
    });
  });
  describe("currentBalance", () => {
    it("should return total earnings when users have no deductions", async () => {
      sinon.stub(recognitionCollection, "count").resolves(100);
      sinon.stub(goldenRecognitionCollection, "count").resolves(0);
      sinon.stub(deductionCollection, "find").resolves([]);

      const result = await balance.currentBalance("User");

      expect(result).to.equal(100);
    });

    it("should return total earnings when users have no deductions and has received golden fistbumps", async () => {
      sinon.stub(recognitionCollection, "count").resolves(100);
      sinon.stub(goldenRecognitionCollection, "count").resolves(4);
      sinon.stub(deductionCollection, "find").resolves([]);

      const result = await balance.currentBalance("User");

      expect(result).to.equal(200);
    });
  });
  describe("lifetimeSpendings", () => {
    it("should sum the total deduction value returned from the db", async () => {
      sinon.stub(deductionCollection, "find").resolves([
        {
          user: "User",
          value: 10,
        },
        {
          user: "User",
          value: 10,
        },
      ]);

      const result = await balance.lifetimeSpendings("User");

      expect(result).to.equal(20);
    });
  });
});
