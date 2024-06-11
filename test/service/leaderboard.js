const sinon = require("sinon");
const expect = require("chai").expect;

const recognition = require("../../service/recognition");
const leaderboard = require("../../service/leaderboard");

describe("service/leaderboard", () => {
  beforeEach(() => {
    sinon.stub(recognition, "getGoldenFistbumpHolder").resolves({
      goldenFistbumpHolder: "XYXA",
      message: "Test Message",
      timestamp: "2022-02-01",
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createLeaderboardBlocks", () => {
    it("should respond with a well-formed leaderboard", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      const result = await leaderboard.createLeaderboardBlocks(30);

      expect(result[0].block_id).to.equal("leaderboardHeader");
      expect(result[1].block_id).to.equal("goldenFistbumpHolder");
      expect(result[2].block_id).to.equal("topGivers");
      expect(result[3].block_id).to.equal("topReceivers");
      expect(result[4].block_id).to.equal("timeRange");
      expect(result[5].block_id).to.equal("leaderboardButtons");
    });

    it("should generate leaderboard from stored data", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves([
        {
          recognizer: "Giver",
          recognizee: "Receiver",
        },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(30);

      expect(result[2].text.text).to.include("<@Giver>");
      expect(result[3].text.text).to.include("<@Receiver>");
    });

    it("should sort leaderboard members", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves([
        {
          recognizer: "GiverA",
          recognizee: "ReceiverA",
        },
        {
          recognizer: "GiverB",
          recognizee: "ReceiverA",
        },
        {
          recognizer: "GiverB",
          recognizee: "ReceiverB",
        },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(30);
      const topGivers = result[2].text.text
        .split("\n")
        .filter((item) => item != "");

      expect(topGivers[1]).to.include("<@GiverB>");
      expect(topGivers[2]).to.include("<@GiverA>");
    });

    it("shouldn't include more than 10 leaderboard members per group", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves([
        {
          recognizer: "Giver1",
          recognizee: "Receiver1",
        },
        {
          recognizer: "Giver2",
          recognizee: "Receiver2",
        },
        {
          recognizer: "Giver3",
          recognizee: "Receiver3",
        },
        {
          recognizer: "Giver4",
          recognizee: "Receiver4",
        },
        {
          recognizer: "Giver5",
          recognizee: "Receiver5",
        },
        {
          recognizer: "Giver6",
          recognizee: "Receiver6",
        },
        {
          recognizer: "Giver7",
          recognizee: "Receiver7",
        },
        {
          recognizer: "Giver8",
          recognizee: "Receiver8",
        },
        {
          recognizer: "Giver9",
          recognizee: "Receiver9",
        },
        {
          recognizer: "Giver10",
          recognizee: "Receiver10",
        },
        {
          recognizer: "Giver11",
          recognizee: "Receiver11",
        },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(30);
      const topGivers = result[2].text.text
        .split("\n")
        .filter((item) => item != "");
      const topReceivers = result[3].text.text
        .split("\n")
        .filter((item) => item != "");

      // Length of 11 accounts for the section header i.e. '*Top Givers*'
      expect(topGivers).to.have.lengthOf(11);
      expect(topReceivers).to.have.lengthOf(11);
    });

    it("should display the selected time range", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      const result = await leaderboard.createLeaderboardBlocks(365);

      expect(result[4].elements[0].text).to.equal("Last 365 days");
    });

    it("should display the golden fistbump holder", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      const result = await leaderboard.createLeaderboardBlocks(365);

      expect(result[1].block_id).to.equal("goldenFistbumpHolder");
      expect(result[1].type).to.equal("section");
      expect(result[1].text.text).to.contain("<@XYXA> - *Test Message*");
    });
  });
});
