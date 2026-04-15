const { mongo_url } = require("../config");
const { MongoClient } = require("mongodb");

const client = new MongoClient(mongo_url);

module.exports = client;
