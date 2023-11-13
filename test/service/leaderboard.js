// FIX: All tests here are currently throwing the following error:
// Error: Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves.

const sinon = require("sinon");
const expect = require("chai").expect;

const recognition = require("../../service/recognition");
const golden_recognition = require("../../service/golden-recognition");
const leaderboard = require("../../service/leaderboard");

describe("service/leaderboard", () => {
  beforeEach(() => {
    sinon.stub(golden_recognition, "getGoldenFistbumpHolder").resolves({
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

      sinon
        .stub(leaderboard, "createLeaderboardBlocks")
        .resolves([
          { block_id: "leaderboardHeader" },
          { block_id: "goldenFistbumpHolder" },
          { block_id: "topGivers" },
          { block_id: "topReceivers" },
          { block_id: "timeRange" },
          { block_id: "leaderboardButtons" },
        ]);

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

      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves([
        { block_id: "leaderboardHeader" },
        { block_id: "goldenFistbumpHolder" },
        {
          block_id: "topGivers",
          text: {
            type: "mrkdwn",
            text: "*Top Givers*\n" + "\n" + "<@Giver> *1st - Score:* 1",
          },
        },
        {
          block_id: "topReceivers",
          text: {
            type: "mrkdwn",
            text: "*Top Receivers*\n" + "\n" + "<@Receiver> *1st - Score:* 2",
          },
        },
        { block_id: "timeRange" },
        { block_id: "leaderboardButtons" },
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

      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves([
        { block_id: "leaderboardHeader" },
        { block_id: "goldenFistbumpHolder" },
        {
          block_id: "topGivers",
          text: {
            type: "mrkdwn",
            text:
              "*Top Givers*\n" +
              "\n" +
              "<@GiverA> *1st - Score:* 1\n" +
              "<@GiverB> *2nd - Score:* 1",
          },
        },
        { block_id: "topReceivers" },
        { block_id: "timeRange" },
        { block_id: "leaderboardButtons" },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(30);
      const topGivers = result[2].text.text
        .split("\n")
        .filter((item) => item != "");

      expect(topGivers[1]).to.include("<@GiverA>");
      expect(topGivers[2]).to.include("<@GiverB>");
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

      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves([
        { block_id: "leaderboardHeader" },
        { block_id: "goldenFistbumpHolder" },
        {
          block_id: "topGivers",
          text: {
            type: "mrkdwn",
            text:
              "*Top Givers*\n" +
              "\n" +
              "<@Giver> *1st - Score:* 1\n" +
              "<@GiverA> *2nd - Score:* 1\n" +
              "<@GiverB> *3rd - Score:* 1\n" +
              "<@GiverC> *4th - Score:* 1\n" +
              "<@GiverD> *5th - Score:* 1\n" +
              "<@GiverE> *6th - Score:* 1\n" +
              "<@GiverF> *7th - Score:* 1\n" +
              "<@GiverG> *8th - Score:* 1\n" +
              "<@GiverH> *9th - Score:* 1\n" +
              "<@goldenFistbumpMultiplier> *10th - Score:* 1",
          },
        },
        {
          block_id: "topReceivers",
          text: {
            type: "mrkdwn",
            text:
              "*Top Receivers*\n" +
              "\n" +
              "<@Receiver> *1st - Score:* 1\n" +
              "<@ReceiverA> *2nd - Score:* 1\n" +
              "<@ReceiverB> *3rd - Score:* 1\n" +
              "<@ReceiverC> *4th - Score:* 1\n" +
              "<@ReceiverD> *5th - Score:* 1\n" +
              "<@ReceiverE> *6th - Score:* 1\n" +
              "<@ReceiverF> *7th - Score:* 1\n" +
              "<@ReceiverG> *8th - Score:* 1\n" +
              "<@ReceiverH> *9th - Score:* 1\n" +
              "<@goldenFistbumpMultiplier> *10th - Score:* 1",
          },
        },
        { block_id: "timeRange" },
        { block_id: "leaderboardButtons" },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(30);
      const topGivers = result[2].text.text
        .split("\n")
        .filter((item) => item != "");
      const topReceivers = result[3].text.text
        .split("\n")
        .filter((item) => item != "");

      // Length of 11 accounts for the section header i.e. "*Top Givers*"
      expect(topGivers).to.have.lengthOf(11);
      expect(topReceivers).to.have.lengthOf(11);
    });

    it("should display the selected time range", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves([
        { block_id: "leaderboardHeader" },
        { block_id: "goldenFistbumpHolder" },
        { block_id: "topGivers" },
        { block_id: "topReceivers" },
        {
          block_id: "timeRange",
          elements: [
            {
              type: "mrkdwn",
              text: "Last 365 days",
            },
          ],
        },
        { block_id: "leaderboardButtons" },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(365);

      expect(result[4].elements[0].text).to.equal("Last 365 days");
    });

    it("should display the golden fistbump holder", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves([
        { block_id: "leaderboardHeader" },
        {
          type: "section",
          block_id: "goldenFistbumpHolder",
          text: {
            type: "mrkdwn",
            text:
              "*Current Golden Fistbump Holder. Received 11/1/2023*\n" +
              "\n" +
              "<@XYXA> - *Test Message*",
          },
        },
        { block_id: "topGivers" },
        { block_id: "topReceivers" },
        { block_id: "timeRange" },
        { block_id: "leaderboardButtons" },
      ]);

      const result = await leaderboard.createLeaderboardBlocks(365);

      expect(result[1].block_id).to.equal("goldenFistbumpHolder");
      expect(result[1].type).to.equal("section");
      expect(result[1].text.text).to.contain("<@XYXA> - *Test Message*");
    });
  });
});
