const sinon = require("sinon");
const suppressLogs = require("mocha-suppress-logs");
const expect = require("chai").expect;
const rewire = require("rewire");

const MockController = require("../mocks/controller");

const helpFeature = rewire("../../features/help");

describe("features / help", () => {
  suppressLogs();
  let controller;

  describe("responds to events", () => {
    beforeEach(async () => {
      controller = new MockController({});
      helpFeature.__set__(
        "respondToHelp",
        sinon.spy(helpFeature.__get__("respondToHelp"))
      );
      helpFeature.__set__(
        "respondToEasterEgg",
        sinon.spy(helpFeature.__get__("respondToEasterEgg"))
      );

      await helpFeature(controller);
    });

    context("when user sends help command", function () {
      let replies;

      beforeEach(async () => {
        await controller.userInput({ text: "help" });
        replies = controller.getReplies();
      });

      it("should respond", async () => {
        expect(replies).to.have.lengthOf(1);
        sinon.assert.calledOnce(helpFeature.__get__("respondToHelp"));
      });
    });

    context("when user sends thunderfury command", function () {
      let replies;

      beforeEach(async () => {
        await controller.userInput({ text: "thunderfury" });
        replies = controller.getReplies();
      });

      it("should respond", async () => {
        expect(replies).to.have.lengthOf(1);
        sinon.assert.calledOnce(helpFeature.__get__("respondToEasterEgg"));
      });
    });
  });
});
