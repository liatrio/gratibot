const balance = require("../service/balance");
const winston = require("../winston");

module.exports = {
  respondToBalance,
};

async function respondToBalance({ user, client }) {
  winston.info("/gratibot balance Called", {
    func: "feature.balance.respondToBalance",
    callingUser: user,
  });

  const userInfo = await client.users.info({ user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      func: "feature.balance.respondToBalance",
      callingUser: user,
      error: userInfo.error,
    });

    return `Something went wrong while obtaining your balance. When retreiving user information from Slack, the API responded with the following error: ${userInfo.error}`;
  }

  const currentBalance = await balance.currentBalance(user);
  const lifetimeTotal = await balance.lifetimeEarnings(user);
  const remainingToday = await balance.dailyGratitudeRemaining(
    user,
    userInfo.user.tz,
    1
  );

  const response = [
    `Your current balance is: \`${currentBalance}\``,
    `Your lifetime earnings are: \`${lifetimeTotal}\``,
    `You have \`${remainingToday}\` left to give away today.`,
  ].join("\n");

  winston.debug("successfully posted ephemeral balance result to Slack", {
    func: "feature.balance.respondToBalance",
    callingUser: user,
  });

  return response;
}
