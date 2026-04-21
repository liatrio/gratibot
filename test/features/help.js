const sinon = require("sinon");
const expect = require("chai").expect;

const helpFeature = require("../../features/help");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/help", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToHelp", () => {
    it("should post the help markdown back to the user via chat.postMessage when the help command is sent as a DM", async () => {
      const { app, findHandler } = createMockApp();
      helpFeature(app);

      const helpHandler = findHandler("message", /help/i);
      const postMessage = sinon.stub().resolves();
      const client = { chat: { postMessage, postEphemeral: sinon.stub() } };
      const message = {
        user: "Ucaller",
        text: "help",
        channel: "Ddm",
        channel_type: "im",
      };

      await helpHandler({ message, client });

      expect(postMessage.calledOnce).to.equal(true);
      const args = postMessage.firstCall.args[0];
      expect(args.channel).to.equal("Ddm");
      expect(args.text).to.include("Give Recognition");
      expect(args.text).to.include("Check Your Status");
      expect(args.text).to.include("Redeem Rewards");
    });
  });

  describe("respondToEasterEgg", () => {
    it("should reply with the thunderfury response via say()", async () => {
      const { app, findHandler } = createMockApp();
      helpFeature(app);

      const easterEggHandler = findHandler(
        "message",
        /(thunderfury|Thunderfury)/,
      );
      const say = sinon.stub().resolves();
      const message = { user: "Ucaller", text: "thunderfury!" };

      await easterEggHandler({ message, say });

      expect(say.calledOnce).to.equal(true);
      expect(say.firstCall.args[0]).to.include(
        ":thunderfury_blessed_blade_of_the_windseeker:",
      );
    });
  });
});
