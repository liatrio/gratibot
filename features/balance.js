const balance = require("../service/balance");
const winston = require("../winston");

module.exports = function (controller) {
  controller.hears(
    "balance",
    ["direct_message", "direct_mention"],
    respondToBalance
  );
};

// TODO: Error Handling
async function respondToBalance(bot, message) {
  winston.info("@gratibot balance Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  const userInfo = await bot.api.users.info({ user: message.user });
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
