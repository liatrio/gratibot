const sinon = require("sinon");
const suppressLogs = require("mocha-suppress-logs");
const expect = require("chai").expect;

const MockController = require("../mocks/controller");

const recognizeFeature = require('../../features/recognize');
const recognition = require('../../service/recognition');
const balance = require('../../service/balance');

describe("features/recognize", () => {
  let controller;

  beforeEach(async () => {
    controller = new MockController({});
    await recognizeFeature(controller);
  })

  it("should update database on valid recognition", async () => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    controller.bot.api.users.info = sinon
      .stub()
      .onFirstCall()
      .resolves(
        {
          ok: true,
          user: {
            id: "AAA1A1AA1",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        }
      )
      .onSecondCall()
      .resolves(
        {
          ok: true,
          user: {
            id: "BBB2B2BB2",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        }
      )

    const reply = await controller.userInput(
      {
        text: ":fistbump: <@BBB2B2BB2> Test Test Test Test Test",
        user: "AAA1A1AA1",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.true;

  })
});
