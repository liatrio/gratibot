const sinon = require("sinon");
const expect = require("chai").expect;
const messageRouter = require("../../features/balance");

describe("feature/balance", () => {
  describe("messageRouter", () => {
    let app;

    beforeEach(() => {
      app = { message: sinon.spy() };
      messageRouter(app);
    });

    it("should register the correct listener", () => {
      expect(app.message.calledOnce).to.be.true;
      const listener = app.message.getCall(0).args[0];
      expect(listener).to.equal("balance");
    });

    it("should register the correct middleware", () => {
      expect(app.message.calledOnce).to.be.true;
      const middleware = app.message.getCall(0).args[1];
      expect(sinon.match.func.test(middleware)).to.be.true;
    });

    it("should register the correct handler", () => {
      expect(app.message.calledOnce).to.be.true;
      const handler = app.message.getCall(0).args[2];
      expect(handler).to.be.a("function");
    });
  });
});
