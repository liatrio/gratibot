const balance = require("../service/balance");
const winston = require("../winston");

module.exports = function (controller) {
  controller.hears(
    "balance",
    ["direct_message", "direct_mention"],
    respondToBalance
  );
};

async function respondToBalance(bot, message) {
  winston.info("@gratibot balance Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  const userInfo = await bot.api.users.info({ user: message.user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      callingUser: message.user,
      slackMessage: message.text,
      error: userInfo.error,
    });
    await bot.replyEphemeral(
      message,
      `Something went wrong while obtaining your balance. When retreiving user information from Slack, the API responded with the following error: ${userInfo.error}`
    );
    return;
  }

  const currentBalance = await balance.currentBalance(message.user);
  const lifetimeTotal = await balance.lifetimeEarnings(message.user);
  const remainingToday = await balance.dailyGratitudeRemaining(
    message.user,
    userInfo.user.tz,
    1
  );

  const response = [
    `Your current balance is: \`${currentBalance}\``,
    `Your lifetime earnings are: \`${lifetimeTotal}\``,
    `You have \`${remainingToday}\` left to give away today.`,
  ].join("\n");

  await bot.replyEphemeral(message, response);
}
