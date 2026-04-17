// Integration tests for service/recognition against a real (in-memory) MongoDB.

const sinon = require("sinon");
const expect = require("chai").expect;

let recognition;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/recognition", function () {
  this.timeout(30000);

  before(async () => {
    recognition = require("../../../service/recognition");
    recognitionCollection = require("../../../database/recognitionCollection");
    goldenRecognitionCollection = require("../../../database/goldenRecognitionCollection");
    deductionCollection = require("../../../database/deductionCollection");
    client = require("../../../database/db");
    await client.connect();
  });

  after(async () => {
    if (client) await client.close();
  });

  beforeEach(async () => {
    await recognitionCollection.deleteMany({});
    await goldenRecognitionCollection.deleteMany({});
    await deductionCollection.deleteMany({});
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getGoldenFistbumpHolder", () => {
    it("should return the most recent golden recognition's recognizee", async () => {
      // Use future timestamps so seeded records beat the module-level
      // auto-seed in database/goldenRecognitionCollection.js, which inserts
      // initialGoldenRecognitionHolder with a require-time timestamp the
      // first time the collection is empty.
      const futureBase = Date.now() + 365 * 24 * 60 * 60 * 1000;
      await goldenRecognitionCollection.insertMany([
        {
          recognizer: "Uprev",
          recognizee: "Uolder",
          timestamp: new Date(futureBase),
          message: "m1",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Uolder",
          recognizee: "Uholder",
          timestamp: new Date(futureBase + 60 * 1000),
          message: "m2",
          channel: "C",
          values: [],
        },
      ]);

      const result = await recognition.getGoldenFistbumpHolder();

      expect(result.goldenFistbumpHolder).to.equal("Uholder");
      expect(result.message).to.equal("m2");
    });
  });

  describe("giveRecognition", () => {
    it("should insert a normal recognition into recognitionCollection when type is the default fistbump", async () => {
      await recognition.giveRecognition(
        "Ugiver",
        "Ureceiver",
        "great work",
        "Cchannel",
        [],
        ":fistbump:",
      );

      const normal = await recognitionCollection.find({}).toArray();
      const golden = await goldenRecognitionCollection.find({}).toArray();
      expect(normal).to.have.lengthOf(1);
      expect(golden).to.have.lengthOf(0);
      expect(normal[0]).to.include({
        recognizer: "Ugiver",
        recognizee: "Ureceiver",
        message: "great work",
        channel: "Cchannel",
      });
    });

    it("should insert a golden recognition into goldenRecognitionCollection when type is the golden emoji", async () => {
      await recognition.giveRecognition(
        "Ugiver",
        "Ureceiver",
        "hand off",
        "Cchannel",
        [],
        ":goldenfistbump:",
      );

      const normal = await recognitionCollection.find({}).toArray();
      // Filter by the test-specific recognizer to ignore the module-level
      // auto-seed (initialGoldenRecognitionHolder) that may or may not have
      // landed depending on initialize-vs-deleteMany timing.
      const golden = await goldenRecognitionCollection
        .find({ recognizer: "Ugiver" })
        .toArray();
      expect(normal).to.have.lengthOf(0);
      expect(golden).to.have.lengthOf(1);
      expect(golden[0]).to.include({
        recognizer: "Ugiver",
        recognizee: "Ureceiver",
        message: "hand off",
        channel: "Cchannel",
      });
    });
  });

  describe("countRecognitionsReceived", () => {
    it("should count every recognition record whose recognizee matches the given user", async () => {
      await recognitionCollection.insertMany([
        {
          recognizer: "Ugiver",
          recognizee: "Ureceiver",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver2",
          recognizee: "Ureceiver",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver",
          recognizee: "Uother",
          timestamp: new Date(),
          message: "m",
          channel: "C",
          values: [],
        },
      ]);

      const count = await recognition.countRecognitionsReceived("Ureceiver");

      expect(count).to.equal(2);
    });
  });
});
