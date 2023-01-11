const sinon = require("sinon");
const expect = require("chai").expect;

const recognition = require("../../service/recognition");
const balance = require("../../service/balance");
const recognitionCollection = require("../../database/recognitionCollection");
const goldenRecognitionCollection = require("../../database/goldenRecognitionCollection");

describe("service/recognition", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getGoldenFistbumpHolder", () => {
    it("should return relevant info about the golden fistbump holder", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });

      const goldenFistbumpInfo = await recognition.getGoldenFistbumpHolder();

      const object = {
        goldenFistbumpHolder: "Receiver",
        message: "Test Message",
        timestamp: new Date(2020, 1, 1),
      };

      expect(goldenFistbumpInfo).to.deep.equal(object);
    });
  });

  describe("doesUserHoldGoldenRecognition", () => {
    it("should return true if user holds the golden fistbump ", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const userHoldsGoldenRecognition =
        await recognition.doesUserHoldGoldenRecognition(
          "Receiver",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.true;
    });

    it("should return false if user doesn't hold the golden fistbump ", async () => {
      sinon.useFakeTimers(new Date(2020, 1, 1));
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const userHoldsGoldenRecognition =
        await recognition.doesUserHoldGoldenRecognition(
          "Receiver2",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.false;
    });

    it("should return false if golden recognition doesn't exist", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves(null);
      sinon.stub(goldenRecognitionCollection, "insert").resolves({});
      const userHoldsGoldenRecognition =
        await recognition.doesUserHoldGoldenRecognition(
          "Receiver",
          "recognizee"
        );
      expect(userHoldsGoldenRecognition).to.be.false;
    });
  });

  describe("composeReceiverNotificationText", () => {
    it("normal fistbump message", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
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
        type: ":fistbump:",
      };

      const message = await recognition.composeReceiverNotificationText(
        gratitude,
        "TestUser",
        10
      );
      expect(message).to.equal(
        "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `10`\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });

    it("golden fistbump given", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
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
        type: ":goldenfistbump:",
      };

      const message = await recognition.composeReceiverNotificationText(
        gratitude,
        "TestUser",
        10
      );
      expect(message).to.equal(
        "Congratulations, You just got the :goldenfistbump: from <@Giver> in <#TestChannel>, and are now the holder of the Golden Fistbump! You earned `1` and your new balance is `10`. While you hold the Golden Fistbump you will receive a 2X multiplier on all fistbumps received!\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });

    it("fistbump given to golden fistbump holder", async () => {
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
          is_bot: false,
          is_restricted: false,
        },
        receivers: [
          {
            id: "test",
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
        type: ":fistbump:",
      };

      const message = await recognition.composeReceiverNotificationText(
        gratitude,
        "test",
        10
      );
      expect(message).to.equal(
        "You just got a :fistbump: from <@Giver> in <#TestChannel>. With :goldenfistbump::goldenfistbump::goldenfistbump::goldenfistbump: multiplier you earned `2` and your new balance is `10`\n>>>:fistbump: <@Receiver> Test Message 1234567890"
      );
    });
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

  describe("groupUsers", () => {
    it("should return a list of users from a mentioned group", async () => {
      const client = {
        usergroups: {
          users: {
            list: sinon.stub().resolves({
              ok: true,
              users: ["TestUserOne", "TestUserTwo"],
            }),
          },
        },
      };
      const results = await recognition.groupUsers(client, "TestGroup");
      expect(results).to.deep.equal(["TestUserOne", "TestUserTwo"]);
    });
  });

  describe("gratitudeReceiverIdsIn", () => {
    it("should find single user mentioned in message", async () => {
      const text = ":fistbump: <@TestUser> Test Message";
      const client = {
        usergroups: {
          users: {
            list: "",
          },
        },
      };
      const results = await recognition.gratitudeReceiverIdsIn(client, text);
      expect(results).to.deep.equal(["TestUser"]);
    });

    it("should find multiple users mentioned in message", async () => {
      const text = ":fistbump: <@TestUserOne> <@TestUserTwo> Test Message";
      const client = {
        usergroups: {
          users: {
            list: "",
          },
        },
      };
      const results = await recognition.gratitudeReceiverIdsIn(client, text);
      expect(results).to.deep.equal(["TestUserOne", "TestUserTwo"]);
    });

    it("should return empty when no users are mentioned in message", async () => {
      const text = ":fistbump: Test Message";
      const client = {
        usergroups: {
          users: {
            list: "",
          },
        },
      };
      const results = await recognition.gratitudeReceiverIdsIn(client, text);
      expect(results).to.deep.equal([]);
    });

    it("should return the users within the group when a group is mentioned", async () => {
      const group = "<!subteam^S1234567890|@TestGroupOne>";
      const text = ":fistbump: " + group + " Test Message";
      const client = {
        usergroups: {
          users: {
            list: sinon.stub().resolves({
              ok: true,
              users: ["TestUserOne", "TestUserTwo"],
            }),
          },
        },
      };
      const results = await recognition.gratitudeReceiverIdsIn(client, text);
      expect(results).to.deep.equal(["TestUserOne", "TestUserTwo"]);
    });

    it("should return the users within the group when a group is mentioned and other users", async () => {
      const group = "<!subteam^S1234567890|@TestGroupOne>";
      const text = ":fistbump: " + group + " <@TestUserThree> Test Message";
      const client = {
        usergroups: {
          users: {
            list: sinon.stub().resolves({
              ok: true,
              users: ["TestUserOne", "TestUserTwo"],
            }),
          },
        },
      };
      const results = await recognition.gratitudeReceiverIdsIn(client, text);
      expect(results).to.deep.equal([
        "TestUserThree",
        "TestUserOne",
        "TestUserTwo",
      ]);
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
        message: ":fistbump: <@Receiver> Test Message",
        trimmedMessage: "  Test Message",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- Your message must be at least 20 characters",
      ]);
    });

    it("should return error if gratitude count is 0", async () => {
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
        count: 0,
        message: ":fistbump: x0 <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- You can't send less than one :fistbump:",
      ]);
    });

    it("should return error if gratitude count is negative", async () => {
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
        count: -10,
        message: ":fistbump: x-10 <@Receiver> Test Message 1234567890",
        trimmedMessage: "  Test Message 1234567890",
        channel: "TestChannel",
        tags: [],
      };

      const result = await recognition.gratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- You can't send less than one :fistbump:",
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

  describe("goldenGratitudeErrors", () => {
    it("should return empty if gratitude is okay", async () => {
      sinon.stub(recognition, "doesUserHoldGoldenRecognition").resolves(true);
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "test",
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

      const result = await recognition.goldenGratitudeErrors(gratitude);
      expect(result).to.deep.equal([]);
    });

    it("should return error if giver does not have golden fistbump", async () => {
      sinon.stub(recognition, "doesUserHoldGoldenRecognition").resolves(false);
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "test",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "test2",
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

      const result = await recognition.goldenGratitudeErrors(gratitude);
      expect(result).to.deep.equal([
        "- Only the current holder of the golden fistbump can give the golden fistbump",
      ]);
    });
  });

  describe("giveGratitude", () => {
    it("should add gratitude to database", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
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
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
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

    it("should give 2 fistbumps to the golden fistbump user if they receive one fistbump", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
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
      await recognition.giveGratitude(gratitude, true);

      expect(insert.calledTwice).to.be.true;
    });

    it("should create a golden recognition if a golden fistbump was given", async () => {
      const insertGoldenRecognition = sinon
        .stub(goldenRecognitionCollection, "insert")
        .resolves({});
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "ReceiverX",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });

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
        type: ":goldenfistbump:",
      };

      await recognition.giveGratitude(gratitude);

      expect(insertGoldenRecognition.called).to.be.true;
    });
  });

  describe("validateAndSendGratitude", () => {
    it("should add gratitude to database if okay", async () => {
      const insert = sinon.stub(recognitionCollection, "insert").resolves({});
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      sinon.stub(recognition, "doesUserHoldGoldenRecognition").resolves(false);
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({});
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
  describe("giverSlackNotification", () => {
    it("should generate a markdown response for recognition", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "Receiver",
          },
        ],
        count: 1,
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Your `1` :fistbump: has been sent. You have `5` left to give today.",
            },
          },
        ],
      };

      const response = await recognition.giverSlackNotification(gratitude);

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should use appropriate grammar for multiple fistbumps", async () => {
      sinon.stub(balance, "dailyGratitudeRemaining").resolves(5);
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "Receiver",
          },
        ],
        count: 2,
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Your `2` :fistbump: have been sent. You have `5` left to give today.",
            },
          },
        ],
      };

      const response = await recognition.giverSlackNotification(gratitude);

      expect(response).to.deep.equal(expectedResponse);
    });
  });
  describe("giverGoldenSlackNotification", () => {
    it("default path for golden fistbump", async () => {
      const gratitude = {
        giver: {
          id: "Giver",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "Receiver",
          },
        ],
        count: 1,
        type: ":goldenfistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You have handed off the :goldenfistbump:. Thanks for sharing the wealth!",
            },
          },
        ],
      };

      const response = await recognition.giverGoldenSlackNotification(
        gratitude
      );

      expect(response).to.deep.equal(expectedResponse);
    });
  });
  describe("receiverSlackNotification", () => {
    it("should generate a markdown response for recognition", async () => {
      sinon.stub(balance, "lifetimeEarnings").resolves(100);
      sinon.stub(balance, "currentBalance").resolves(5);
      sinon
        .stub(recognition, "composeReceiverNotificationText")
        .resolves(
          "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `5`\n>>>Test Message"
        );
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "GiverX",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "ReceiverX",
          },
        ],
        count: 1,
        channel: "TestChannel",
        message: "Test Message",
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You just got a :fistbump: from <@GiverX> in <#TestChannel>. You earned `1` and your new balance is `5`\n>>>Test Message",
            },
          },
        ],
      };

      const response = await recognition.receiverSlackNotification(
        gratitude,
        "ReceiverX"
      );

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should include additional message for first time earners", async () => {
      sinon.stub(balance, "lifetimeEarnings").resolves(1);
      sinon.stub(balance, "currentBalance").resolves(1);
      sinon
        .stub(recognition, "composeReceiverNotificationText")
        .resolves(
          "You just got a :fistbump: from <@Giver> in <#TestChannel>. You earned `1` and your new balance is `1`\n>>>Test Message"
        );
      sinon.stub(goldenRecognitionCollection, "findOne").resolves({
        recognizer: "Giver",
        recognizee: "Receiver",
        timestamp: new Date(2020, 1, 1),
        message: "Test Message",
        channel: "Test Channel",
        values: ["Test Tag"],
      });
      const gratitude = {
        giver: {
          id: "GiverX",
          tz: "America/Los_Angeles",
        },
        receivers: [
          {
            id: "ReceiverX",
          },
        ],
        count: 1,
        channel: "TestChannel",
        message: "Test Message",
        type: ":fistbump:",
      };
      const expectedResponse = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You just got a :fistbump: from <@GiverX> in <#TestChannel>. You earned `1` and your new balance is `1`\n>>>Test Message",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "I noticed this is your first time receiving a :fistbump:. Check out <https://liatrio.atlassian.net/wiki/spaces/LE/pages/817857117/Redeeming+Fistbumps|Confluence> to see what they can be used for, or try running `<@gratibot> help` for more information about me.",
            },
          },
        ],
      };

      const response = await recognition.receiverSlackNotification(
        gratitude,
        "ReceiverX"
      );

      expect(response).to.deep.equal(expectedResponse);
    });
  });
});
