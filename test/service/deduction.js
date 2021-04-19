const sinon = require("sinon");
const expect = require("chai").expect;

const deduction = require("../../service/deduction");
const deductionCollection = require("../../database/deductionCollection");

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
        value: 10,
        message: "",
      };
      expect(insert.args[0][0]).to.deep.equal(object);
    });
  });
  describe("createDeduction", () => {
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
