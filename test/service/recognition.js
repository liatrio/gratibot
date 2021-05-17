const sinon = require("sinon");
const expect = require("chai").expect;

const recognition = require("../../service/recognition");
const balance = require("../../service/balance");
const recognitionCollection = require("../../database/recognitionCollection");

describe("service/recognition", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("giveRecognition", () => {
    it("should insert data into db", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      sinon.useFakeTimers(new Date(2020, 1, 1));

      await recognition.giveRecognition(
        "Giver",
        "Receiver",
        "Test Message",
        "Test Channel",
        ["Test Tag"]
      );

      const object = {
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      };
      expect(insert.args[0][0]).to.deep.equal(object);
    });
  });
  describe("countRecognitionsReceived", () => {
    it("should return count of recognition in db", async () => {
      sinon.stub(recognitionCollection, "count").resolves(10);

      const result = await recognition.countRecognitionsReceived("User");

      expect(result).to.equal(10);
    });
    it("should filter results if times are specified", async () => {
      const count = sinon.stub(recognitionCollection, "count").resolves(0);
      sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1)));

      await recognition.countRecognitionsReceived(
        "User",
        "America/Los_Angeles",
        2
      );

      const filter = {
        recognizee: "User",
        timestamp: {
          $gte: new Date(Date.UTC(2020, 0, 30, 8)),
        },
      };

      expect(count.args[0][0]).to.deep.equal(filter);
    });
  });
  describe("countRecognitionsGiven", () => {
    it("should return count of recognition in db", async () => {
      sinon.stub(recognitionCollection, "count").resolves(10);

      const result = await recognition.countRecognitionsGiven("User");

      expect(result).to.equal(10);
    });
    it("should filter results if times are specified", async () => {
      const count = sinon.stub(recognitionCollection, "count").resolves(0);
      sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1)));

      await recognition.countRecognitionsGiven(
        "User",
        "America/Los_Angeles",
        2
      );

      const filter = {
        recognizer: "User",
        timestamp: {
          $gte: new Date(Date.UTC(2020, 0, 30, 8)),
        },
      };

      expect(count.args[0][0]).to.deep.equal(filter);
    });
  });
  describe("getPreviousXDaysOfRecognition", () => {
    it("should return recognition in db", async () => {
      sinon.stub(recognitionCollection, "find").resolves([
        {
          recognizer: "Giver",
          recognizee: "Receiver",
          timestamp: new Date(2020, 1, 1),
          message: "Test Message",
          channel: "Test Channel",
          values: ["Test Tag"],
        },
      ]);

      const result = await recognition.getPreviousXDaysOfRecognition();

      const object = [
        {
          recognizer: "Giver",
          recognizee: "Receiver",
          timestamp: new Date(2020, 1, 1),
          message: "Test Message",
          channel: "Test Channel",
          values: ["Test Tag"],
        },
      ];
      expect(result).to.deep.equal(object);
    });
    it("should filter results if times are specified", async () => {
      const find = sinon.stub(recognitionCollection, "find").resolves([]);
      sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1)));

      await recognition.getPreviousXDaysOfRecognition("America/Los_Angeles", 2);

      const filter = {
        timestamp: {
          $gte: new Date(Date.UTC(2020, 0, 30, 8)),
        },
      };

      expect(find.args[0][0]).to.deep.equal(filter);
    });
  });

  describe("gratitudeReceiverIdsIn", () => {
    it("should find single user mentioned in message", async () => {
      const text = ":fistbump: <@TestUser> Test Message";
      const results = recognition.gratitudeReceiverIdsIn(text);
      expect(results).to.deep.equal(["TestUser"]);
    });

    it("should find multiple users mentioned in message", async () => {
      const text = ":fistbump: <@TestUserOne> <@TestUserTwo> Test Message";
      const results = recognition.gratitudeReceiverIdsIn(text);
      expect(results).to.deep.equal(["TestUserOne", "TestUserTwo"]);
    });

    it("should return empty when no users are mentioned in message", async () => {
      const text = ":fistbump: Test Message";
      const results = recognition.gratitudeReceiverIdsIn(text);
      expect(results).to.deep.equal([]);
    });
  });

  describe("gratitudeCountIn", () => {
    it("should add all fistbumps in the message", async () => {
      const text = ":fistbump: :fistbump: <@TestUser> Test Message";
      const result = recognition.gratitudeCountIn(text);
      expect(result).to.equal(2);
    });

    it("should return zero when message has no fistbumps", async () => {
      const text = "<@TestUser> Test Message";
      const result = recognition.gratitudeCountIn(text);
      expect(result).to.equal(0);
    });

    it("should support multiplication", async () => {
      const text = ":fistbump: x5 <@TestUser> Test Message";
      const result = recognition.gratitudeCountIn(text);
      expect(result).to.equal(5);
    });

    it("should support multiplication along with multiple emoji", async () => {
      const text = ":fistbump: :fistbump: x2 <@TestUser> Test Message";
      const result = recognition.gratitudeCountIn(text);
      expect(result).to.equal(4);
    });

    it("shouldn't multiply by negative numbers", async () => {
      const text = ":fistbump: x-6 <@TestUser> Test Message";
      const result = recognition.gratitudeCountIn(text);
      expect(result).to.equal(1);
    });
  });

  describe("gratitudeTagsIn", () => {
    it("should find a tag in message", async () => {
      const text = ":fistbump: <@TestUser> Test Message #TestTag";
      const result = recognition.gratitudeTagsIn(text);
      expect(result).to.deep.equal(["TestTag"]);
    });

    it("should find multiple tags in message", async () => {
      const text =
        ":fistbump: <@TestUser> Test Message #TestTagOne #TestTagTwo";
      const result = recognition.gratitudeTagsIn(text);
      expect(result).to.deep.equal(["TestTagOne", "TestTagTwo"]);
    });

    it("should return empty with no tags", async () => {
      const text = ":fistbump: <@TestUser> Test Message";
      const result = recognition.gratitudeTagsIn(text);
      expect(result).to.deep.equal([]);
    });
  });

  describe("trimmedGratitudeMessage", () => {
    it("should remove user mentions from message", async () => {
      const text = "<@TestUser> Test Message";
      const result = recognition.trimmedGratitudeMessage(text);
      expect(result).to.equal(" Test Message");
    });

    it("should remove emojis from message", async () => {
      const text = ":fistbump: Test Message";
      const result = recognition.trimmedGratitudeMessage(text);
      expect(result).to.equal(" Test Message");
    });

    it("should return input if no user mentions or emojis are in message", async () => {
      const text = "Test Message";
      const result = recognition.trimmedGratitudeMessage(text);
      expect(result).to.equal("Test Message");
    });
  });

  describe("gratitudeErrors", () => {
    it("should return empty if gratitude is okay", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([]);
    });

    it("should return error if no receivers", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- Mention who you want to recognize with @user",
      ]);
    });

    it("should return error on self-recognition", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Giver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal(["- You can't recognize yourself"]);
    });

    it("should return error if giver is a bot", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: true,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal(["- Bots can't give recognition"]);
    });

    it("should return error if giver is a guest user", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: true,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal(["- Guest users can't give recognition"]);
    });

    it("should return error if receiver is a bot", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: true,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal(["- You can't give recognition to bots"]);
    });

    it("should return error if receiver is a guest user", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: true,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- You can't give recognition to guest users",
      ]);
    });

    it("should return error if message is too short", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- Your message must be at least 20 characters",
      ]);
    });

    it("should return error if giver can't afford recognition", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(0);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- A maximum of 5 :fistbump: can be sent per day",
      ]);
    });
  });

  describe("giveGratitude", () => {
    it("should add gratitude to database", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };
      await recognition.giveGratitude(gratitude);

      expect(insert.called).to.be.true;
    });

    it("should add multiple gratitude to database", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 2,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };
      await recognition.giveGratitude(gratitude);

      expect(insert.calledTwice).to.be.true;
    });
  });
  describe("validateAndSendGratitude", () => {
    it("should add gratitude to database if okay", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };
      await recognition.validateAndSendGratitude(gratitude);

      expect(insert.called).to.be.true;
    });

    it("should throw error if not okay", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(0);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        ],
        count: 1,
        message: ":fistbump: <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      expect(recognition.validateAndSendGratitude(gratitude)).to.be.rejected;
    });
  });
});
