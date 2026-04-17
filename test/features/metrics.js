const sinon = require("sinon");
const expect = require("chai").expect;

const metricsFeature = require("../../features/metrics");
const metrics = require("../../service/metrics");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/metrics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToMetrics", () => {
    it("should post Gratibot Metrics text with blocks from createMetricsBlocks", async () => {
      const { app, registrations } = createMockApp();
      metricsFeature(app);
      const handler = registrations.message[0].handler;

      const fakeBlocks = [{ type: "section" }];
      sinon.stub(metrics, "createMetricsBlocks").resolves(fakeBlocks);

      const client = {
        chat: {
          postMessage: sinon.stub().resolves(),
          postEphemeral: sinon.stub().resolves(),
        },
      };
      const message = {
        user: "U1",
        text: "metrics",
        channel: "D1",
        channel_type: "im",
      };

      await handler({ message, client });

      expect(metrics.createMetricsBlocks.firstCall.args[0]).to.equal(30);
      expect(client.chat.postMessage.calledOnce).to.equal(true);
      const args = client.chat.postMessage.firstCall.args[0];
      expect(args.text).to.equal("Gratibot Metrics");
      expect(args.blocks).to.equal(fakeBlocks);
    });
  });

  describe("updateMetricsResponse", () => {
    it("should ack and respond with new blocks keyed by action.value", async () => {
      const { app, registrations } = createMockApp();
      metricsFeature(app);
      const actionHandler = registrations.action[0].handler;

      const fakeBlocks = [{ type: "section" }];
      sinon.stub(metrics, "createMetricsBlocks").resolves(fakeBlocks);

      const ack = sinon.stub().resolves();
      const respond = sinon.stub().resolves();
      const body = { user: { id: "U1" } };
      const action = { value: "90" };

      await actionHandler({ ack, body, action, respond });

      expect(ack.calledOnce).to.equal(true);
      expect(metrics.createMetricsBlocks.firstCall.args[0]).to.equal("90");
      expect(respond.calledOnce).to.equal(true);
      expect(respond.firstCall.args[0]).to.deep.equal({ blocks: fakeBlocks });
    });
  });
});
