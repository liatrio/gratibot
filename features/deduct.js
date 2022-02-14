const deduction = require("../service/deduction");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "deduct",
    anyOf(directMention(), directMessage()),
    attemptDeduction
  );
};

async function attemptDeduction({ message, context, client }) {
  winston.info("@gratibot deduct Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  const matches = message.text.match(/deduct\s+([0-9]+)(\s+.*)?$/);
  if (!matches) {
    winston.info("Failed to parse deduct input");
    const response = [
      "Please specify an amount to deduct,",
      `Ex: \`<@${context.botUserId}> deduct 100 Optional Message\``,
    ].join(" ");
    return client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: response,
    });
  }

  const deductionValue = parseInt(matches[1], 10);
  const deductionMessage = matches[2]?.trim() | "";
  if (deductionValue <= 0) {
    return client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: "You can only deduct positive numbers.",
    });
  }
  if (!(await deduction.isBalanceSufficent(message.user, deductionValue))) {
    return client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: "Your current balance isn't high enough to deduct that much",
    });
  }
  await deduction.createDeduction(
    message.user,
    deductionValue,
    deductionMessage
  );
  return client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: `Deducted ${deductionValue} from your current balance.`,
  });
}
