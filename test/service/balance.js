const sinon = require("sinon");
const expect = require("chai").expect;

const config = require("../../config");
const balance = require("../../service/balance");
const recognitionCollection = require("../../database/recognitionCollection");

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
});
