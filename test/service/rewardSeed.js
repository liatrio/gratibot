const sinon = require("sinon");
const expect = require("chai").expect;
const fs = require("fs");
const path = require("path");

const rewardCollection = require("../../database/rewardCollection");
const { seedRewards } = require("../../service/rewardSeed");

const rewardsJsonPath = path.resolve(__dirname, "../../rewards.json");
const rewardsJson = JSON.parse(fs.readFileSync(rewardsJsonPath));

describe("service/rewardSeed", function () {
  afterEach(function () {
    sinon.restore();
  });

  describe("seedRewards", function () {
    it("should insert all rewards when the collection is empty", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      expect(insertMany.calledOnce).to.equal(true);
      const docs = insertMany.firstCall.args[0];
      expect(docs).to.have.length(rewardsJson.length);
      expect(docs).to.have.length(14);
    });

    it("should mark only the Liatrio Store entry with kind: 'liatrio-store'", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      const docs = insertMany.firstCall.args[0];
      const store = docs.find(function (d) {
        return d.name === "Liatrio Store";
      });
      expect(store.kind).to.equal("liatrio-store");
      const others = docs.filter(function (d) {
        return d.name !== "Liatrio Store";
      });
      others.forEach(function (d) {
        expect(d.kind).to.equal(undefined);
      });
    });

    it("should stamp active: true, system-seed audit fields, and monotonic sortOrder matching the JSON position", async function () {
      sinon.stub(rewardCollection, "countDocuments").resolves(0);
      const insertMany = sinon.stub(rewardCollection, "insertMany").resolves();

      await seedRewards();

      const docs = insertMany.firstCall.args[0];
      docs.forEach(function (doc, index) {
        expect(doc.active).to.equal(true);
        expect(doc.createdBy).to.equal("system-seed");
        expect(doc.updatedBy).to.equal("system-seed");
        expect(doc.sortOrder).to.equal(index);
        expect(doc.createdAt).to.be.an.instanceof(Date);
        expect(doc.updatedAt).to.be.an.instanceof(Date);
        expect(doc.name).to.equal(rewardsJson[index].name);
      });
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
