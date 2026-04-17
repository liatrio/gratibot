const sinon = require("sinon");
const expect = require("chai").expect;

const refundFeature = require("../../features/refund");
const refund = require("../../service/refund");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/refund", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should register a message handler whose matcher is /refund/i and whose handler is refund.respondToRefund", () => {
    const { app, registrations } = createMockApp();
    refundFeature(app);

    expect(registrations.message.length).to.equal(1);
    const { matchers, handler } = registrations.message[0];

    const regexMatcher = matchers.find((m) => m instanceof RegExp);
    expect(regexMatcher).to.not.equal(undefined);
    expect(regexMatcher.source).to.equal("refund");
    expect(regexMatcher.flags).to.include("i");

    expect(handler).to.equal(refund.respondToRefund);
  });
});
