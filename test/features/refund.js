const sinon = require("sinon");
const expect = require("chai").expect;

const refundFeature = require("../../features/refund");
const refund = require("../../service/refund");
const { createMockApp } = require("../mocks/bolt-app");

describe("features/refund", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("registers multiline generic refunds without capturing Stadium resolution", () => {
    const { app, registrations, findHandler } = createMockApp();
    refundFeature(app);

    const handler = findHandler(
      "message",
      /^(?!.*\bstadium\s+resolve\b.*\brefund\b).*\brefund\b/is,
    );
    expect(handler).to.equal(refund.respondToRefund);
    const matcher = registrations.message[0].matchers[0];
    expect(
      matcher.test("Refunding this one:\nrefund 62171d78b5daaa0011771cfd"),
    ).to.equal(true);
    expect(matcher.test("stadium resolve stadium:T1:V1\nrefund")).to.equal(
      false,
    );
    expect(
      matcher.test(
        "refund 62171d78b5daaa0011771cfd — not the stadium resolve path",
      ),
    ).to.equal(true);
  });
});
