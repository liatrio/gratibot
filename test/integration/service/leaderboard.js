const sinon = require("sinon");
const expect = require("chai").expect;

let leaderboard;
let recognitionCollection;
let goldenRecognitionCollection;
let deductionCollection;
let client;

describe("integration: service/leaderboard", function () {
  this.timeout(30000);

  before(async () => {
    leaderboard = require("../../../service/leaderboard");
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
    await Promise.all([
      recognitionCollection.deleteMany({}),
      goldenRecognitionCollection.deleteMany({}),
      deductionCollection.deleteMany({}),
    ]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createLeaderboardBlocks", () => {
    it("should return a blocks array whose topReceivers section names the seeded top recognizee", async () => {
      const now = new Date();
      await recognitionCollection.insertMany([
        // Utop gets 3 recognitions from 2 unique givers — top receiver.
        {
          recognizer: "Ugiver1",
          recognizee: "Utop",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver2",
          recognizee: "Utop",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
        {
          recognizer: "Ugiver1",
          recognizee: "Utop",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
        // Ubelow gets 1 recognition — should rank lower.
        {
          recognizer: "Ugiver1",
          recognizee: "Ubelow",
          timestamp: now,
          message: "m",
          channel: "C",
          values: [],
        },
      ]);
      // Seed a golden holder so the goldenFistbumpHolder block can render.
      await goldenRecognitionCollection.insertOne({
        recognizer: "Uprev",
        recognizee: "Uholder",
        timestamp: now,
        message: "thanks",
        channel: "C",
        values: [],
      });

      const blocks = await leaderboard.createLeaderboardBlocks(30);

      const byId = Object.fromEntries(
        blocks.filter((b) => b.block_id).map((b) => [b.block_id, b]),
      );

      expect(byId.leaderboardHeader.text.text).to.equal("*Leaderboard*");
      expect(byId.goldenFistbumpHolder.text.text).to.include("<@Uholder>");
      expect(byId.topReceivers.text.text).to.include("<@Utop>");
      expect(byId.topReceivers.text.text).to.include("*1st - Score:*");
      expect(byId.topGivers.text.text).to.include("<@Ugiver1>");
      expect(byId.timeRange.elements[0].text).to.equal("Last 30 days");
      expect(byId.leaderboardButtons.elements).to.have.lengthOf(4);
    });
  });
});
