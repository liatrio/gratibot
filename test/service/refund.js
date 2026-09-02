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
        text: "gratibot refund 62171d78b5daaa0011771cfd",
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
      sinon.stub(deduction, "refundDeduction").resolves({ status: "refunded" });
      await refund.respondToRefund(testObject);
      sinon.assert.calledWith(testClient.chat.postMessage, {
        channel: testMessage.channel,
        user: testMessage.user,
        text: "Refund successfully given",
      });
    });

    it("should accept a deduction id copied with backticks", async () => {
      const client = { chat: { postMessage: sinon.stub() } };
      const refundStub = sinon
        .stub(deduction, "refundDeduction")
        .resolves({ status: "refunded" });

      await refund.respondToRefund({
        message: {
          user: "testAdmin",
          channel: "testchannel",
          text: "refund `62171d78b5daaa0011771cfd`",
        },
        client,
        admins: ["testAdmin"],
      });

      sinon.assert.calledWith(refundStub, "62171d78b5daaa0011771cfd");
    });

    it("should direct Stadium deductions to the resolution command", async () => {
      const client = { chat: { postMessage: sinon.stub() } };
      const refundStub = sinon
        .stub(deduction, "refundDeduction")
        .resolves({ status: "stadium" });

      await refund.respondToRefund({
        message: {
          user: "testAdmin",
          channel: "testchannel",
          text: "refund stadium:T1:V1",
        },
        client,
        admins: ["testAdmin"],
      });

      sinon.assert.calledWith(refundStub, "stadium:T1:V1");
      sinon.assert.calledWith(
        client.chat.postMessage,
        sinon.match({
          text: sinon.match("stadium resolve <id> refund"),
        }),
      );
    });

    it("should reject a malformed refund command", async () => {
      const client = { chat: { postMessage: sinon.stub() } };
      const refundStub = sinon.stub(deduction, "refundDeduction");
      await refund.respondToRefund({
        message: {
          user: "testAdmin",
          channel: "testchannel",
          text: "stadium resolve stadium:T:V refund",
        },
        client,
        admins: ["testAdmin"],
      });
      sinon.assert.notCalled(refundStub);
      sinon.assert.calledWith(
        client.chat.postMessage,
        sinon.match({
          text: "Usage: `refund <deduction-id>`",
        }),
      );
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
