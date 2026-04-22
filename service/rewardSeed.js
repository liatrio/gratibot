const rewardCollection = require("../database/rewardCollection");
const winston = require("../winston");

const SEED_REWARDS = [
  {
    name: "Liatrio Store",
    description:
      "Choose an item from the <https://liatrio.axomo.com/|Liatrio Store>. 2 Fistbumps = 1 Dollar.",
    imageURL:
      "https://gratibotjtest.blob.core.windows.net/gratibotimages/Liatrio_Logo.png",
    cost: 0,
    sortOrder: 0,
    kind: "liatrio-store",
  },
];

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

    const now = new Date();
    const docs = SEED_REWARDS.map(function (reward) {
      return {
        name: reward.name,
        description: reward.description,
        imageURL: reward.imageURL,
        cost: reward.cost,
        active: true,
        sortOrder: reward.sortOrder,
        kind: reward.kind,
        createdBy: "system-seed",
        updatedBy: "system-seed",
        createdAt: now,
        updatedAt: now,
      };
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

module.exports = { seedRewards, SEED_REWARDS };
