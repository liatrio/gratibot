const sinon = require("sinon");
const expect = require("chai").expect;

const refundFeature = require("../../features/refund");
const refund = require("../../service/refund");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/refund", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should register refund.respondToRefund against the /refund/i message matcher", () => {
    const { app, findHandler } = createMockApp();
    refundFeature(app);

    const handler = findHandler("message", /refund/i);
    expect(handler).to.equal(refund.respondToRefund);
  });
});
