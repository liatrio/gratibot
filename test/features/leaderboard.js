const sinon = require("sinon");
const expect = require("chai").expect;

const leaderboardFeature = require("../../features/leaderboard");
const leaderboard = require("../../service/leaderboard");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/leaderboard", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToLeaderboard", () => {
    it("should post Gratibot Leaderboard text with blocks from createLeaderboardBlocks", async () => {
      const { app, findHandler } = createMockApp();
      leaderboardFeature(app);
      const handler = findHandler("message", /leaderboard/i);

      const fakeBlocks = [
        { type: "section", text: { type: "mrkdwn", text: "top" } },
      ];
      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves(fakeBlocks);

      const client = {
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
      };
      const message = {
        user: "U1",
        text: "leaderboard",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(leaderboard.createLeaderboardBlocks.calledOnce).to.equal(true);
      expect(leaderboard.createLeaderboardBlocks.firstCall.args[0]).to.equal(
        30,
      );
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.equal("Gratibot Leaderboard");
      expect(args.blocks).to.equal(fakeBlocks);
    });
  });

  describe("updateLeaderboardResponse", () => {
    it("should ack and respond with new blocks keyed by action.value", async () => {
      const { app, findHandler } = createMockApp();
      leaderboardFeature(app);
      const actionHandler = findHandler("action", /leaderboard-\d+/);

      const fakeBlocks = [{ type: "section" }];
      sinon.stub(leaderboard, "createLeaderboardBlocks").resolves(fakeBlocks);

      const ack = sinon.stub().resolves();
      const respond = sinon.stub().resolves();
      const body = { user: { id: "U1" } };
      const action = { value: "90" };

      await actionHandler({ ack, body, action, respond });

      expect(ack.calledOnce).to.equal(true);
      expect(leaderboard.createLeaderboardBlocks.firstCall.args[0]).to.equal(
        "90",
      );
      expect(respond.calledOnce).to.equal(true);
      expect(respond.firstCall.args[0]).to.deep.equal({ blocks: fakeBlocks });
    });
  });
});
