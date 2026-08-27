const winston = require("../winston");
const deduction = require("./deduction");
const config = require("../config");
const { redemptionAdmins } = config;

async function respondToRefund({ message, client, admins = redemptionAdmins }) {
  winston.info("@gratibot refund Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  if (admins.includes(message.user)) {
    const match = message.text.match(
      /\brefund\s+`?((?:[a-f\d]{24})|(?:stadium:[^\s`]+))`?\s*$/i,
    );
    if (!match) {
      await client.chat.postMessage({
        channel: message.channel,
        user: message.user,
        text: "Usage: `refund <deduction-id>`",
      });
      return;
    }
    const deductionId = match[1];
    const result = await deduction.refundDeduction(deductionId);

    const messages = {
      refunded: "Refund successfully given",
      already_refunded: "That deduction has already been refunded",
      not_found: "That deduction could not be found",
      stadium:
        "Stadium deductions must be resolved with `stadium resolve <id> refund`.",
    };

    await client.chat.postMessage({
      channel: message.channel,
      user: message.user,
      text: messages[result.status],
    });
  } else {
    await client.chat.postMessage({
      channel: message.channel,
      user: message.user,
      text: "Only `Redemption Admins` can use the refund command",
    });
  }
}

module.exports = {
  respondToRefund,
};
