const deduction = require("../service/deduction");
const balance = require("../service/balance");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware")

module.exports = function (app) {
  app.message("deduct", anyOf(directMention(), directMessage()), attemptDeduction);
};

async function failedToParseInput(bot, message) {
  winston.info("Heard 'deduct' but failed to parse input", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  const response = [
    "Please specify an amount to deduct,",
    `Ex: \`<@${message.incoming_message.recipient.id}> deduct 100 Optional Message\``,
  ].join(" ");

  await bot.replyEphemeral(message, response);
}

async function attemptDeduction({ message, context, client }) {
  winston.info("@gratibot deduct Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  const matches = message.text.match(/deduct\s+([0-9]+)(\s+.*)?$/)
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
  if (!(await isBalanceSufficent(message.user, deductionValue))) {
    return client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: "Your current balance isn't high enough to deduct that much"
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
    text: `Deducted ${deductionValue} from your current balance.`
  });
}

async function isBalanceSufficent(user, deductionValue) {
  return (await balance.currentBalance(user)) >= deductionValue;
}
