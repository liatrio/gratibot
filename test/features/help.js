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
      const { app, registrations } = createMockApp();
      helpFeature(app);

      // The first registered app.message(...) call in features/help.js is
      // the /help/i handler; subsequent ones are the easter egg.
      const helpHandler = registrations.message[0].handler;
      const postMessage = sinon.stub().resolves();
      const client = { chat: { postMessage, postEphemeral: sinon.stub() } };
      const message = {
        user: "U123",
        text: "help",
        channel: "D456",
        channel_type: "im",
      };

      await helpHandler({ message, client });

      expect(postMessage.calledOnce).to.equal(true);
      const args = postMessage.firstCall.args[0];
      expect(args.channel).to.equal("D456");
      expect(args.text).to.include("Give Recognition");
      expect(args.text).to.include("View Balance");
    });
  });

  describe("respondToEasterEgg", () => {
    it("should reply with the thunderfury response via say()", async () => {
      const { app, registrations } = createMockApp();
      helpFeature(app);

      const easterEggHandler = registrations.message[1].handler;
      const say = sinon.stub().resolves();
      const message = { user: "U123", text: "thunderfury!" };

      await easterEggHandler({ message, say });

      expect(say.calledOnce).to.equal(true);
      expect(say.firstCall.args[0]).to.include(
        ":thunderfury_blessed_blade_of_the_windseeker:",
      );
    });
  });
});
