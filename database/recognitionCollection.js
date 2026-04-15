const client = require("./db");
const recognitionCollection = client.db().collection("recognition");

recognitionCollection.createIndex({ recognizer: 1 });
recognitionCollection.createIndex({ recognizee: 1 });
recognitionCollection.createIndex({ timestamp: 1 });

module.exports = recognitionCollection;
