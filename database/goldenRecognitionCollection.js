const db = require('./db')
const winston = require("../winston");
const goldenRecognitionCollection = db.get('goldenrecognition')
const {initialGoldenRecognitionHolder} = require('../config');


goldenRecognitionCollection.createIndex('recognizer')
goldenRecognitionCollection.createIndex('recognizee')
goldenRecognitionCollection.createIndex('timestamp')

async function initializeGoldenRecognitionCollection () {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } }
  );
  if (!goldenRecognition) {
    const collectionValues = {
      recognizer: initialGoldenRecognitionHolder,
      recognizee: initialGoldenRecognitionHolder,
      timestamp: "2022-02-08T00:58:12.779Z",
      message: "initial golden recognition",
      channel: "",
      values: [],
    };

    winston.info("Creating initial golden recognition holder");
    await goldenRecognitionCollection.insert(collectionValues)
  }
}


initializeGoldenRecognitionCollection();

module.exports = goldenRecognitionCollection
