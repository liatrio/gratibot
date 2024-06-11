const sinon = require("sinon");
const refund = require("../../service/refund");
const deduction = require("../../service/deduction");

describe("service/refund", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("respondToRefund", () => {
    it("should return a successful refund message to user", async () => {
      const testMessage = {
        user: "testAdmin",
        channel: "testchannel",
        text: "gratibot refund deductionid",
      };
      const testClient = {
        chat: {
          postMessage: sinon.stub(),
        },
      };
      const testAdmins = ["testAdmin"];
      const testObject = {
        message: testMessage,
        client: testClient,
        admins: testAdmins,
      };
      sinon.stub(deduction, "refundDeduction").resolves({});
      await refund.respondToRefund(testObject);
      sinon.assert.calledWith(testClient.chat.postMessage, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "Refund Successfully given",
      });
    });

    it("should return a message informing user that they must be redemption admin", async () => {
      const testMessage = {
        user: "testUser",
        channel: "testchannel",
        text: "gratibot refund deductionid",
      };
      const testClient = {
        chat: {
          postMessage: sinon.stub(),
        },
      };
      const testAdmins = ["testAdmin"];
      const testObject = {
        message: testMessage,
        client: testClient,
        admins: testAdmins,
      };
      sinon.stub(deduction, "refundDeduction").resolves({});
      await refund.respondToRefund(testObject);
      sinon.assert.calledWith(testClient.chat.postMessage, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "Only `Redemption Admins` can use the refund command",
      });
    });
  });
});
