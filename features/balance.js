const balance = require("../service/balance");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "balance",
    anyOf(directMention, directMessage()),
    respondToBalance,
  );
};

async function respondToBalance({ message, client }) {
  winston.info("@gratibot balance Called", {
    func: "feature.balance.respondToBalance",
    callingUser: message.user,
    slackMessage: message.text,
  });

  const userInfo = await client.users.info({ user: message.user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      func: "feature.balance.respondToBalance",
      callingUser: message.user,
      slackMessage: message.text,
      error: userInfo.error,
    });
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `Something went wrong while obtaining your balance. When retreiving user information from Slack, the API responded with the following error: ${userInfo.error}`,
    });
    return;
  }

  const currentBalance = await balance.currentBalance(message.user);
  const lifetimeTotal = await balance.lifetimeEarnings(message.user);
  const remainingToday = await balance.dailyGratitudeRemaining(
    message.user,
    userInfo.user.tz,
    1,
  );

  const response = [
    `Your current balance is: \`${currentBalance}\``,
    `Your lifetime earnings are: \`${lifetimeTotal}\``,
    `You have \`${remainingToday}\` left to give away today.`,
  ].join("\n");

  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: response,
  });

  winston.debug("successfully posted ephemeral balance result to Slack", {
    func: "feature.balance.respondToBalance",
    callingUser: message.user,
    slackMessage: message.text,
  });
}
