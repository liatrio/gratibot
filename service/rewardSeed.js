const fs = require("fs");
const path = require("path");
const rewardCollection = require("../database/rewardCollection");
const winston = require("../winston");

async function seedRewards() {
  try {
    const existingCount = await rewardCollection.countDocuments({});
    if (existingCount > 0) {
      winston.debug("Reward seed skipped; collection already populated", {
        func: "seedRewards",
        existingCount,
      });
      return;
    }

    const rawData = fs.readFileSync(path.resolve(__dirname, "../rewards.json"));
    const rewards = JSON.parse(rawData);
    const now = new Date();
    const docs = rewards.map(function (reward, index) {
      const doc = {
        name: reward.name,
        description: reward.description,
        imageURL: reward.imageURL,
        cost: reward.cost,
        active: true,
        sortOrder: index,
        createdBy: "system-seed",
        updatedBy: "system-seed",
        createdAt: now,
        updatedAt: now,
      };
      if (reward.name === "Liatrio Store") {
        doc.kind = "liatrio-store";
      }
      return doc;
    });

    await rewardCollection.insertMany(docs);
    winston.info("Reward collection seeded", {
      func: "seedRewards",
      insertedCount: docs.length,
    });
  } catch (error) {
    winston.error("Reward seed failed", {
      func: "seedRewards",
      error: error.message,
    });
    throw error;
  }
}

module.exports = { seedRewards };
