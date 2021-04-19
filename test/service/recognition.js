const sinon = require("sinon");
const expect = require("chai").expect;

const recognition = require("../../service/recognition");
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
});
