const sinon = require("sinon");
const expect = require("chai").expect;

const config = require("../../config");
const report = require("../../service/report");
const recognitionCollection = require("../../database/recognitionCollection");

describe("service/report", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getTopMessagesForUser", () => {
    it("should map aggregation results to the expected shape with a formatted date", async () => {
      const firstTimestamp = new Date("2024-01-01T12:00:00Z");
      sinon.stub(recognitionCollection, "aggregate").returns({
        toArray: sinon.stub().resolves([
          {
            _id: "great work",
            count: 3,
            firstTimestamp,
            channel: "Cchannel",
            recognizers: ["Ugiver1", "Ugiver2"],
          },
        ]),
      });

      const result = await report.getTopMessagesForUser(
        "Utarget",
        30,
        "America/Los_Angeles",
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.include({
        message: "great work",
        count: 3,
        timestamp: firstTimestamp,
        channel: "Cchannel",
      });
      expect(result[0].recognizers).to.deep.equal(["Ugiver1", "Ugiver2"]);
      expect(result[0].formattedDate).to.equal("Jan 1, 2024");
    });

    it("should return an empty array when the aggregation returns no results", async () => {
      sinon.stub(recognitionCollection, "aggregate").returns({
        toArray: sinon.stub().resolves([]),
      });

      const result = await report.getTopMessagesForUser("Utarget");

      expect(result).to.deep.equal([]);
    });

    it("should rethrow when the aggregation fails", async () => {
      sinon.stub(recognitionCollection, "aggregate").returns({
        toArray: sinon.stub().rejects(new Error("boom")),
      });

      await expect(report.getTopMessagesForUser("Utarget")).to.be.rejectedWith(
        "boom",
      );
    });
  });

  describe("getTotalRecognitionsForUser", () => {
    it("should return the count returned by the collection", async () => {
      sinon.stub(recognitionCollection, "countDocuments").resolves(7);

      const result = await report.getTotalRecognitionsForUser(
        "Utarget",
        30,
        "America/Los_Angeles",
      );

      expect(result).to.equal(7);
    });

    it("should rethrow when countDocuments fails", async () => {
      sinon
        .stub(recognitionCollection, "countDocuments")
        .rejects(new Error("db error"));

      await expect(
        report.getTotalRecognitionsForUser("Utarget"),
      ).to.be.rejectedWith("db error");
    });
  });

  describe("createUserTopMessagesBlocks", () => {
    it("should include the empty-state section when there are no top messages", async () => {
      const blocks = await report.createUserTopMessagesBlocks(
        "Utarget",
        [],
        0,
        30,
      );

      const section = blocks.find(
        (block) =>
          block.type === "section" &&
          block.text &&
          block.text.text &&
          block.text.text.startsWith(`No ${config.recognizeEmoji}`),
      );
      expect(section).to.not.be.undefined;
    });

    it("should render recognizers inline when there are three or fewer", async () => {
      const blocks = await report.createUserTopMessagesBlocks(
        "Utarget",
        [
          {
            message: "amazing",
            count: 2,
            timestamp: new Date("2024-02-02"),
            formattedDate: "Feb 2, 2024",
            channel: "Cchannel",
            recognizers: ["Ugiver1", "Ugiver2"],
          },
        ],
        2,
        30,
      );

      const messageSection = blocks.find(
        (block) =>
          block.type === "section" &&
          block.text &&
          block.text.text &&
          block.text.text.includes('_"amazing"_'),
      );
      expect(messageSection).to.not.be.undefined;
      expect(messageSection.text.text).to.include(
        "from <@Ugiver1>, <@Ugiver2>",
      );
    });

    it("should collapse recognizers to the first plus a count when there are more than three", async () => {
      const blocks = await report.createUserTopMessagesBlocks(
        "Utarget",
        [
          {
            message: "team effort",
            count: 4,
            timestamp: new Date("2024-03-03"),
            formattedDate: "Mar 3, 2024",
            channel: "Cchannel",
            recognizers: ["Ugiver1", "Ugiver2", "Ugiver3", "Ugiver4"],
          },
        ],
        4,
        30,
      );

      const messageSection = blocks.find(
        (block) =>
          block.type === "section" &&
          block.text &&
          block.text.text &&
          block.text.text.includes('_"team effort"_'),
      );
      expect(messageSection).to.not.be.undefined;
      expect(messageSection.text.text).to.include(
        "from <@Ugiver1> and 3 others",
      );
    });

    it("should finish with an actions block containing the three time-range buttons", async () => {
      const blocks = await report.createUserTopMessagesBlocks(
        "Utarget",
        [],
        0,
        30,
      );

      const actions = blocks[blocks.length - 1];
      expect(actions.type).to.equal("actions");
      expect(actions.elements).to.have.lengthOf(3);
      expect(actions.elements.map((el) => el.value)).to.deep.equal([
        "Utarget:30",
        "Utarget:180",
        "Utarget:365",
      ]);
    });
  });
});
