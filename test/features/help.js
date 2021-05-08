const sinon = require("sinon");
const suppressLogs = require("mocha-suppress-logs");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const helpFeature = require("../../features/help");

describe("features/help", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    await helpFeature(controller);
  });

  describe("a help request", () => {
    it("should respond", async () => {
      await controller.userInput({ text: "help" });
      let replies = controller.getReplies();

      expect(replies).to.have.lengthOf(1);
    });
  });

  describe("an easter egg request", () => {
    it("should respond", async () => {
      await controller.userInput({ text: "thunderfury" });
      let replies = controller.getReplies();

      expect(replies).to.have.lengthOf(1);
    });
  });
});
