const sinon = require("sinon");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const leaderboardFeature = require("../../features/leaderboard");
const recognition = require("../../service/recognition");

describe("features/leaderboard", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    await leaderboardFeature(controller);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("a leaderboard request", () => {
    it("should respond with a well-formed leaderboard", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.userInput({
        text: "leaderboard",
      });
      let response = controller.getReplies()[0].response;

      expect(response.blocks[0].block_id).to.equal("leaderboardHeader");
      expect(response.blocks[1].block_id).to.equal("topGivers");
      expect(response.blocks[2].block_id).to.equal("topReceivers");
      expect(response.blocks[3].block_id).to.equal("timeRange");
      expect(response.blocks[4].block_id).to.equal("leaderboardButtons");
    });

    it("should generate leaderboard from stored data", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves([
        {
          recognizer: "Giver",
          recognizee: "Receiver",
        },
      ]);

      await controller.userInput({
        text: "leaderboard",
      });
      let response = controller.getReplies()[0].response;

      expect(response.blocks[1].text.text).to.include("<@Giver>");
      expect(response.blocks[2].text.text).to.include("<@Receiver>");
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

      await controller.userInput({
        text: "leaderboard",
      });
      let response = controller.getReplies()[0].response;
      let topGivers = response.blocks[1].text.text
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

      await controller.userInput({
        text: "leaderboard",
      });
      let response = controller.getReplies()[0].response;
      let topGivers = response.blocks[1].text.text
        .split("\n")
        .filter((item) => item != "");
      let topReceivers = response.blocks[2].text.text
        .split("\n")
        .filter((item) => item != "");

      // Length of 11 accounts for the section header i.e. '*Top Givers*'
      expect(topGivers).to.have.lengthOf(11);
      expect(topReceivers).to.have.lengthOf(11);
    });
  });

  describe("a leaderboard interactive button click", () => {
    it("should use data from the selected time range", async () => {
      const getRecognition = sinon
        .stub(recognition, "getPreviousXDaysOfRecognition")
        .resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "leaderboardButtons",
            value: 365,
          },
        ],
      });

      expect(getRecognition.args[0][1]).to.equal(365);
    });

    it("should display the selected time range", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "leaderboardButtons",
            value: 365,
          },
        ],
      });
      let response = controller.getReplies()[0].response;

      expect(response.blocks[3].elements[0].text).to.equal("Last 365 days");
    });
  });

  describe("a non-leaderboard interactive button click", () => {
    it("should be ignored", async () => {
      sinon.stub(recognition, "getPreviousXDaysOfRecognition").resolves({});

      await controller.event("block_actions", {
        actions: [
          {
            block_id: "metricButtons",
            value: 365,
          },
        ],
      });

      expect(controller.getReplies()).to.be.empty;
    });
  });
});
