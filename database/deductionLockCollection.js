const client = require("./db");

module.exports = client.db().collection("deductionLocks");
