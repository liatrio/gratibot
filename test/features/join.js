const sinon = require("sinon");
const expect = require("chai").expect;

const joinFeature = require("../../features/join");
const { SlackError } = require("../../service/errors");
const { createMockApp } = require("../mocks/bolt-app");

function buildClient(join = sinon.stub()) {
  return {
    conversations: { join },
    chat: {
      postMessage: sinon.stub().resolves(),
      postEphemeral: sinon.stub().resolves(),
    },
  };
}

function buildEvent() {
  return {
    channel: { id: "Cnew" },
    channel_type: "channel",
    user: "U1",
  };
}

describe("features/join", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("joinPublicChannel", () => {
    it("should invoke client.conversations.join with the new channel id on the happy path", async () => {
      const { app, registrations } = createMockApp();
      joinFeature(app);
      const handler = registrations.event[0].handler;

      const join = sinon.stub();
      const client = buildClient(join);
      const event = buildEvent();

      await handler({ event, client });

      expect(join.calledOnce).to.equal(true);
      expect(join.firstCall.args[0]).to.deep.equal({ channel: "Cnew" });
      expect(client.chat.postEphemeral.called).to.equal(false);
    });

    it("should dispatch handleSlackError when conversations.join throws a SlackError", async () => {
      const { app, registrations } = createMockApp();
      joinFeature(app);
      const handler = registrations.event[0].handler;

      const join = sinon
        .stub()
        .throws(new SlackError("conversations.join", "not_authed", "Nope"));
      const client = buildClient(join);
      const event = buildEvent();

      await handler({ event, client });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      expect(client.chat.postEphemeral.firstCall.args[0].text).to.equal("Nope");
    });

    it("should dispatch handleGenericError when conversations.join throws a plain Error", async () => {
      const { app, registrations } = createMockApp();
      joinFeature(app);
      const handler = registrations.event[0].handler;

      const join = sinon.stub().throws(new Error("boom"));
      const client = buildClient(join);
      const event = buildEvent();

      await handler({ event, client });

      expect(client.chat.postEphemeral.calledOnce).to.equal(true);
      const text = client.chat.postEphemeral.firstCall.args[0].text;
      expect(text).to.include("An unknown error occured in Gratibot");
      expect(text).to.include("boom");
    });
  });
});
