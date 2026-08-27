const sinon = require("sinon");
const { ObjectId } = require("mongodb");
const expect = require("chai").expect;

const deduction = require("../../service/deduction");
const deductionCollection = require("../../database/deductionCollection");
const deductionLockCollection = require("../../database/deductionLockCollection");

const balance = require("../../service/balance");

describe("deduction/balance", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("createDeduction", () => {
    it("should insert data into db", async () => {
      const insert = sinon
        .stub(deductionCollection, "insertOne")
        .resolves({ acknowledged: true, insertedId: new ObjectId() });
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
      const insert = sinon
        .stub(deductionCollection, "insertOne")
        .resolves({ acknowledged: true, insertedId: new ObjectId() });
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
        .resolves({ refund: false });

      const result = await deduction.refundDeduction(
        "62171d78b5daaa0011771cfd",
      );
      expect(result.status).to.equal("refunded");
      sinon.assert.calledWith(
        findOneAndUpdate,
        {
          _id: new ObjectId("62171d78b5daaa0011771cfd"),
          source: { $ne: "stadium" },
          refund: false,
        },
        { $set: { refund: true } },
      );
    });

    it("should reject invalid, missing, refunded, and Stadium deductions", async () => {
      expect((await deduction.refundDeduction("bad-id")).status).to.equal(
        "not_found",
      );
      sinon.stub(deductionCollection, "findOneAndUpdate").resolves(null);
      const find = sinon.stub(deductionCollection, "findOne");
      find.onCall(0).resolves(null);
      find.onCall(1).resolves({ refund: true });
      find.onCall(2).resolves({ source: "stadium", refund: false });
      const id = "62171d78b5daaa0011771cfd";
      expect((await deduction.refundDeduction(id)).status).to.equal(
        "not_found",
      );
      expect((await deduction.refundDeduction(id)).status).to.equal(
        "already_refunded",
      );
      expect((await deduction.refundDeduction(id)).status).to.equal("stadium");
    });

    it("should protect string-id Stadium deductions from generic refunds", async () => {
      const update = sinon
        .stub(deductionCollection, "findOneAndUpdate")
        .resolves(null);
      const find = sinon
        .stub(deductionCollection, "findOne")
        .resolves({ source: "stadium", refund: false });

      expect(
        (await deduction.refundDeduction("stadium:T1:V1")).status,
      ).to.equal("stadium");
      sinon.assert.calledWith(
        update,
        {
          _id: "stadium:T1:V1",
          source: { $ne: "stadium" },
          refund: false,
        },
        { $set: { refund: true } },
      );
      sinon.assert.calledWith(find, { _id: "stadium:T1:V1" });
    });
  });

  describe("isBalanceSufficient", () => {
    it("should return true if balance is sufficient", async () => {
      sinon.stub(balance, "currentBalance").resolves(20);

      const result = await deduction.isBalanceSufficient("testUser", 10);
      expect(result).to.be.true;
    });

    it("should return false if balance is not sufficient", async () => {
      sinon.stub(balance, "currentBalance").resolves(20);

      const result = await deduction.isBalanceSufficient("testUser", 30);
      expect(result).to.be.false;
    });
  });

  describe("deduction locks", () => {
    beforeEach(() => {
      sinon.stub(deductionCollection, "findOne").resolves(null);
    });

    it("acquires and releases a lock for an operation", async () => {
      const insert = sinon
        .stub(deductionLockCollection, "insertOne")
        .resolves({ acknowledged: true });
      const remove = sinon
        .stub(deductionLockCollection, "deleteOne")
        .resolves({ deletedCount: 1 });
      expect(await deduction.acquireLock("U1", "operation")).to.deep.equal({
        acquired: true,
      });
      await deduction.releaseLock("U1", "operation");
      expect(insert.firstCall.args[0]).to.include({
        _id: "U1",
        operationId: "operation",
        kind: "ephemeral",
      });
      expect(insert.firstCall.args[0].expiresAt).to.be.instanceOf(Date);
      sinon.assert.calledWith(
        remove,
        sinon.match({ _id: "U1", operationId: "operation" }),
      );
    });

    it("returns details for an existing user lock", async () => {
      sinon
        .stub(deductionLockCollection, "insertOne")
        .rejects(Object.assign(new Error("duplicate"), { code: 11000 }));
      sinon.stub(deductionLockCollection, "findOneAndUpdate").resolves(null);
      sinon.stub(deductionLockCollection, "findOne").resolves({
        operationId: "existing",
        kind: "ephemeral",
      });
      expect(await deduction.acquireLock("U1", "operation")).to.deep.equal({
        acquired: false,
        reason: "in-progress",
        operationId: "existing",
      });
    });

    it("atomically replaces an expired lock", async () => {
      sinon
        .stub(deductionLockCollection, "insertOne")
        .rejects(Object.assign(new Error("duplicate"), { code: 11000 }));
      const replace = sinon
        .stub(deductionLockCollection, "findOneAndUpdate")
        .resolves({ operationId: "old" });
      expect(await deduction.acquireLock("U1", "new")).to.deep.equal({
        acquired: true,
      });
      expect(replace.firstCall.args[0]).to.have.nested.property(
        "expiresAt.$lte",
      );
      expect(replace.firstCall.args[1].$set).to.include({
        operationId: "new",
        kind: "ephemeral",
      });
      expect(replace.firstCall.args[1].$set).not.to.have.property("_id");
    });

    it("uses a needs-review deduction as the authoritative hold", async () => {
      deductionCollection.findOne.resolves({ _id: "stadium:T1:V1" });
      const insert = sinon.stub(deductionLockCollection, "insertOne");

      expect(await deduction.acquireLock("U1", "new")).to.deep.equal({
        acquired: false,
        reason: "stadium-review",
        operationId: "stadium:T1:V1",
      });
      sinon.assert.notCalled(insert);
    });
  });

  describe("getDeductions", () => {
    it("should return deductions found in db", async () => {
      sinon.stub(deductionCollection, "find").returns({
        toArray: sinon.stub().resolves([
          {
            user: "User",
            value: 100,
          },
        ]),
      });

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
      const find = sinon
        .stub(deductionCollection, "find")
        .returns({ toArray: sinon.stub().resolves([]) });
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
