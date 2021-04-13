const sinon = require("sinon");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const deductFeature = require("../../features/deduct");
const deduction = require("../../service/deduction");
const balance = require("../../service/balance");

describe("features/recognize", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});

    await deductFeature(controller);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("a deduct request", () => {
    it("should update database on valid deduction", async () => {
      const createDeduction = sinon
        .stub(deduction, "createDeduction")
        .resolves("");

      sinon.stub(balance, "currentBalance").resolves(100);

      await controller.userInput({
        text: "deduct 100",
      });

      expect(createDeduction.called).to.be.true;
    });

    it("shouldn't update database when deduction value is less than 0", async () => {
      const createDeduction = sinon
        .stub(deduction, "createDeduction")
        .resolves("");

      sinon.stub(balance, "currentBalance").resolves(100);

      await controller.userInput({
        text: "deduct -50",
      });

      expect(createDeduction.called).to.be.false;
    });

    it("shouldn't update database when deduction value is 0", async () => {
      const createDeduction = sinon
        .stub(deduction, "createDeduction")
        .resolves("");

      sinon.stub(balance, "currentBalance").resolves(100);

      await controller.userInput({
        text: "deduct 0",
      });

      expect(createDeduction.called).to.be.false;
    });
    it("shouldn't update database when deduction value is greater than requester's balance", async () => {
      const createDeduction = sinon
        .stub(deduction, "createDeduction")
        .resolves("");

      sinon.stub(balance, "currentBalance").resolves(99);

      await controller.userInput({
        text: "deduct 100",
      });

      expect(createDeduction.called).to.be.false;
    });
  });

  describe("an incorrectly formed deduct request", () => {
    it("should explain the request format to the user", async () => {
      const createDeduction = sinon
        .stub(deduction, "createDeduction")
        .resolves("");
      controller.info.id = "Gratibot";

      await controller.userInput({
        text: "deduct",
        user: "Requester",
      });
      let response = controller.getReplies()[0].response;

      expect(createDeduction.called).to.be.false;
      expect(response).to.include(
        "Ex: `<@Gratibot> deduct 100 Optional Message`"
      );
    });
  });
});
