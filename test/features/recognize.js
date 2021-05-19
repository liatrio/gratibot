const sinon = require("sinon");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const recognizeFeature = require("../../features/recognize");
const recognition = require("../../service/recognition");
const { GratitudeError } = require("../../service/errors");

describe("features/recognize", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    controller.bot.api.users.info
      .withArgs({ user: "Giver" })
      .resolves({
        ok: true,
        user: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      })
      .withArgs({ user: "Receiver" })
      .resolves({
        ok: true,
        user: {
          id: "Receiver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
      })
      .withArgs({ user: "NotARealUser" })
      .resolves({
        ok: false,
        error: "user_not_found",
      });

    await recognizeFeature(controller);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("a recognition message", () => {
    it("should respond when recognition is okay", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      await controller.userInput({
        text: ":fistbump: <@Receiver> Test Message",
        user: "Giver",
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Giver Notification");
    });

    it("should respond with error when user info can't be found", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon
        .stub(recognition, "gratitudeReceiverIdsIn")
        .returns(["NotARealUser"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      await controller.userInput({
        text: ":fistbump: <@NotARealUser> Test Message",
        user: "Giver",
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Recognition has not been sent.");
    });

    it("should respond with error when gratitude is invalid", async () => {
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .throws(new GratitudeError(["Test Gratitude Error"]));
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      await controller.userInput({
        text: ":fistbump: <@Receiver> Test Message",
        user: "Giver",
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Gratitude Error");
    });

    it("should respond with error unknown errors occur", async () => {
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .throws(new Error("Test Unknown Error"));
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      await controller.userInput({
        text: ":fistbump: <@Receiver> Test Message",
        user: "Giver",
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Unknown Error");
    });
  });

  describe("a recognition reaction", () => {
    it("should respond when recognition is okay", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: true,
        messages: [{ text: ":fistbump: <@Receiver> Test Message" }],
      });

      await controller.event("reaction_added", {
        reaction: ":nail_care:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Giver Notification");
    });

    it("should respond with error when original message can't be found", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: false,
        error: "thread_not_found",
      });

      await controller.event("reaction_added", {
        reaction: ":nail_care:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Recognition has not been sent.");
    });

    it("should respond with error when gratitude is invalid", async () => {
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .throws(new GratitudeError(["Test Gratitude Error"]));
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: true,
        messages: [{ text: ":fistbump: <@Receiver> Test Message" }],
      });

      await controller.event("reaction_added", {
        reaction: ":nail_care:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Gratitude Error");
    });

    it("should respond with error unknown errors occur", async () => {
      sinon
        .stub(recognition, "validateAndSendGratitude")
        .throws(new Error("Test Unknown Error"));
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: true,
        messages: [{ text: ":fistbump: <@Receiver> Test Message" }],
      });

      await controller.event("reaction_added", {
        reaction: ":nail_care:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      const reply = controller.getReplies()[0].response;
      expect(reply).to.include("Test Unknown Error");
    });

    it("should ignore reactions that aren't the reaction emoji", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: true,
        messages: [{ text: ":fistbump: <@Receiver> Test Test Test Test Test" }],
      });

      await controller.event("reaction_added", {
        reaction: ":some_other_emoji:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      expect(controller.getReplies()).to.have.length.of(0);
    });

    it("should ignore reactions to messages that were not gratitude", async () => {
      sinon.stub(recognition, "validateAndSendGratitude").resolves("");
      sinon.stub(recognition, "gratitudeReceiverIdsIn").returns(["Receiver"]);
      sinon.stub(recognition, "gratitudeCountIn").returns(1);
      sinon
        .stub(recognition, "trimmedGratitudeMessage")
        .returns("Test Message");
      sinon.stub(recognition, "gratitudeTagsIn").returns("");
      sinon
        .stub(recognition, "giverSlackNotification")
        .resolves("Test Giver Notification");
      sinon
        .stub(recognition, "receiverSlackNotification")
        .resolves("Test Receiver Notification");

      controller.bot.api.conversations.replies.resolves({
        ok: true,
        messages: [
          { text: ":some_other_emoji: <@Receiver> Test Test Test Test Test" },
        ],
      });

      await controller.event("reaction_added", {
        reaction: ":nail_care:",
        user: "Giver",
        item: {
          type: "message",
          channel: "SomeChannel",
          ts: "1",
        },
      });

      expect(controller.getReplies()).to.have.length.of(0);
    });
  });
});
