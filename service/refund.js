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
    const messageText = message.text.split(" ");
    await deduction.removeDeduction(messageText[2]);

    await client.chat.postMessage({
      channel: message.channel,
      user: message.user,
      text: "Refund Successfully given",
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
