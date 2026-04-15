const client = require("./db");
const winston = require("../winston");
const goldenRecognitionCollection = client.db().collection("goldenrecognition");
const { initialGoldenRecognitionHolder } = require("../config");

goldenRecognitionCollection.createIndex({ recognizer: 1 });
goldenRecognitionCollection.createIndex({ recognizee: 1 });
goldenRecognitionCollection.createIndex({ timestamp: 1 });

async function initializeGoldenRecognitionCollection() {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } },
  );
  if (!goldenRecognition) {
    const collectionValues = {
      recognizer: initialGoldenRecognitionHolder,
      recognizee: initialGoldenRecognitionHolder,
      timestamp: new Date(),
      message: "initial golden recognition",
      channel: "",
      values: [],
    };

    winston.info("Creating initial golden recognition holder");
    await goldenRecognitionCollection.insertOne(collectionValues);
  }
}

initializeGoldenRecognitionCollection().catch((e) =>
  winston.error("Failed to initialize golden recognition collection", {
    func: "initializeGoldenRecognitionCollection",
    error: e.message,
  }),
);

module.exports = goldenRecognitionCollection;
