const client = require("./db");
const deductionCollection = client.db().collection("deduction");

deductionCollection.createIndex({ user: 1 });
deductionCollection.createIndex({ timestamp: 1 });
deductionCollection.createIndex({ refund: 1 });
deductionCollection.createIndex({ source: 1 });
deductionCollection.createIndex({ status: 1 });
deductionCollection.createIndex({ "reviewNotification.nextAttemptAt": 1 });

module.exports = deductionCollection;
