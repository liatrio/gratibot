const client = require("./db");
const rewardCollection = client.db().collection("rewards");

rewardCollection.createIndex({ active: 1, sortOrder: 1 });
rewardCollection.createIndex({ sortOrder: 1, name: 1 });

module.exports = rewardCollection;
