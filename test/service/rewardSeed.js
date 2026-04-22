const sinon = require("sinon");
const expect = require("chai").expect;

const rewardCollection = require("../../database/rewardCollection");
const { seedRewards, SEED_REWARDS } = require("../../service/rewardSeed");

describe("service/rewardSeed", function () {
  afterEach(function () {
    sinon.restore();
  });

  describe("SEED_REWARDS", function () {
    it("should contain exactly one entry, the Liatrio Store", function () {
      expect(SEED_REWARDS).to.have.length(1);
      expect(SEED_REWARDS[0].name).to.equal("Liatrio Store");
      expect(SEED_REWARDS[0].kind).to.equal("liatrio-store");
    });
  });

  describe("seedRewards", function () {
    it("should insert the inline seed entry when the collection is empty", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      expect(insertMany.calledOnce).to.equal(true);
      const docs = insertMany.firstCall.args[0];
      expect(docs).to.have.length(1);
      expect(docs[0].name).to.equal("Liatrio Store");
      expect(docs[0].kind).to.equal("liatrio-store");
    });

    it("should stamp active: true, system-seed audit fields, and sortOrder from the inline seed", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      const doc = insertMany.firstCall.args[0][0];
      expect(doc.active).to.equal(true);
      expect(doc.createdBy).to.equal("system-seed");
      expect(doc.updatedBy).to.equal("system-seed");
      expect(doc.sortOrder).to.equal(SEED_REWARDS[0].sortOrder);
      expect(doc.createdAt).to.be.an.instanceof(Date);
      expect(doc.updatedAt).to.be.an.instanceof(Date);
    });

    it("should not insert when the collection already has documents", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(1);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      expect(insertMany.called).to.equal(false);
    });

    it("should rethrow when the underlying insert fails", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      sinon.stub(rewardCollection, "insertMany").rejects(new Error("boom"));

      let caught;
      try {
        await seedRewards();
      } catch (e) {
        caught = e;
      }
      expect(caught).to.be.an.instanceof(Error);
      expect(caught.message).to.equal("boom");
    });
  });
});
