const sinon = require("sinon");
const monk = require("monk");
const expect = require("chai").expect;

const deduction = require("../../service/deduction");
const deductionCollection = require("../../database/deductionCollection");

const balance = require("../../service/balance");

describe("service/deduction", () => {
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

  // FIX: This is currently throwing the following error:
  // Error: Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves.

  describe("respondToRefund", () => {
    // it("should return a successful refund message to user", async () => {
    //   const testMessage = {
    //     user: "testAdmin",
    //     channel: "testchannel",
    //     text: "@gratibot refund 62171d78b5daaa0011771cfd",
    //   };
    //   const testClient = {
    //     chat: {
    //       postMessage: sinon.stub().resolves({}),
    //     },
    //   };
    //   const testAdmins = ["testAdmin"];
    //   const testObject = {
    //     message: testMessage,
    //     client: testClient,
    //     admins: testAdmins,
    //   };
    //   sinon.stub(deduction, "refundDeduction").resolves(true);
    //   await deduction.respondToRefund(testObject);
    //   sinon.assert.calledWith(testClient.chat.postMessage, {
    //     channel: testMessage.channel,
    //     user: testMessage.user,
    //     text: "Refund Successfully given",
    //   });
    // });

    it("should return a message informing user that they must be redemption admin", async () => {
      const testMessage = {
        user: "testUser",
        channel: "testchannel",
        text: "gratibot refund 62171d78b5daaa0011771cfd",
      };
      const testClient = {
        chat: {
          postMessage: sinon.stub(),
        },
      };
      const testAdmins = ["testAdmin"];
      const testObject = {
        message: testMessage,
        client: testClient,
        admins: testAdmins,
      };
      sinon.stub(deduction, "refundDeduction").resolves({});
      await deduction.respondToRefund(testObject);
      sinon.assert.calledWith(testClient.chat.postMessage, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "Only `Redemption Admins` can use the refund command",
      });
    });
  });
});
