const sinon = require("sinon");
const monk = require("monk");
const expect = require("chai").expect;

const deduction = require("../../service/deduction");
const deductionCollection = require("../../database/deductionCollection");

const balance = require("../../service/balance");

describe("deduction/balance", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("createDeduction", () => {
    it("should insert data into db", async () => {
      const insert = sinon.stub(deductionCollection, "insert").resolves({});
      sinon.useFakeTimers(new Date(2020, 1, 1));

      await deduction.createDeduction("User", 10, "Test Message");

      const object = {
        user: "User",
        timestamp: new Date(2020, 1, 1),
        refund: false,
        value: 10,
        message: "Test Message",
      };
      expect(insert.args[0][0]).to.deep.equal(object);
    });
    it("should allow for message to be optional", async () => {
      const insert = sinon.stub(deductionCollection, "insert").resolves({});
      sinon.useFakeTimers(new Date(2020, 1, 1));

      await deduction.createDeduction("User", 10);

      const object = {
        user: "User",
        timestamp: new Date(2020, 1, 1),
        refund: false,
        value: 10,
        message: "",
      };
      expect(insert.args[0][0]).to.deep.equal(object);
    });
  });
  describe("refundDeduction", () => {
    it("should call refund deduction", async () => {
      const findOneAndUpdate = sinon
        .stub(deductionCollection, "findOneAndUpdate")
        .resolves({});

      await deduction.refundDeduction("62171d78b5daaa0011771cfd");
      sinon.assert.calledWith(findOneAndUpdate, {
        _id: monk.id("62171d78b5daaa0011771cfd"),
      });
    });
  });
  describe("isBalanceSufficent", () => {
    it("should return true if balance is sufficient", async () => {
      sinon.stub(balance, "currentBalance").resolves(20);

      const result = await deduction.isBalanceSufficent("testUser", 10);
      expect(result).to.be.true;
    });
    it("should return false if balance is not sufficient", async () => {
      sinon.stub(balance, "currentBalance").resolves(20);

      const result = await deduction.isBalanceSufficent("testUser", 30);
      expect(result).to.be.false;
    });
  });
  describe("getDeductions", () => {
    it("should return deductions found in db", async () => {
      sinon.stub(deductionCollection, "find").resolves([
        {
          user: "User",
          value: 100,
        },
      ]);

      const result = await deduction.getDeductions("User");

      const object = [
        {
          user: "User",
          value: 100,
        },
      ];
      expect(result).to.deep.equal(object);
    });
    it("should filter results if times are specified", async () => {
      const find = sinon.stub(deductionCollection, "find").resolves([]);
      sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1)));

      await deduction.getDeductions("User", "America/Los_Angeles", 2);

      const filter = {
        user: "User",
        timestamp: {
          $gte: new Date(Date.UTC(2020, 0, 30, 8)),
        },
      };

      expect(find.args[0][0]).to.deep.equal(filter);
    });
  });
});
