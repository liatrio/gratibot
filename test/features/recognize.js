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


    controller.bot.api.users.info
      .withArgs({ user:"Giver" })
      .resolves(
        {
          ok: true,
          user: {
            id: "Giver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        }
      )
      .withArgs({ user: "Receiver" })
      .resolves(
        {
          ok: true,
          user: {
            id: "Receiver",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: false,
          },
        }
      )
      .withArgs({ user: "BotUser" })
      .resolves(
        {
          ok: true,
          user: {
            id: "BotUser",
            tz: "America/Los_Angeles",
            is_bot: true,
            is_restricted: false,
          },
        }
      )
      .withArgs({ user: "GuestUser" })
      .resolves(
        {
          ok: true,
          user: {
            id: "GuestUser",
            tz: "America/Los_Angeles",
            is_bot: false,
            is_restricted: true,
          },
        }
      );

    await recognizeFeature(controller);
  })

  afterEach(() => {
    sinon.restore();
  });

  it("should update database on valid recognition", async () => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@Receiver> Test Test Test Test Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.true;
  })

  it("shouldn't update database when there are no receivers", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: Test Test Test Test Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when giver matches a receiver", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@Giver> Test Test Test Test Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when giver is a bot user", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@Receiver> Test Test Test Test Test",
        user: "BotUser",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when giver is a guest user", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@Receiver> Test Test Test Test Test",
        user: "GuestUser",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when receiver is a bot user", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@BotUser> Test Test Test Test Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when receiver is a guest user", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@GuestUser> Test Test Test Test Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when message is too short", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(5);

    await controller.userInput(
      {
        text: ":fistbump: <@Receiver> Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })

  it("shouldn't update database when giver has no recognition to spend", async() => {
    const giveRecognition = sinon.stub(recognition, 'giveRecognition').resolves("");
    sinon.stub(recognition, 'countRecognitionsReceived').resolves(1);
    sinon.stub(balance, 'dailyGratitudeRemaining').resolves(0);

    await controller.userInput(
      {
        text: ":fistbump: <@Receiver> Test",
        user: "Giver",
        channel: "SomeChannel",
      }
    )

    expect(giveRecognition.called).to.be.false;
  })
});
