const config = require("../config");
const winston = require("../winston");
const moment = require("moment-timezone");

const recognitionCollection = require("../database/recognitionCollection");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const deductionCollection = require("../database/deductionCollection");

async function currentBalance(user) {
  const earning = await lifetimeEarnings(user);
  const spending = await lifetimeSpendings(user);

  winston.debug(
    `${user} current earnings are [${earning}] and spendings are [${spending}]`,
    {
      func: "service.balance.currentBalance",
    }
  );

  return earning - spending;
}

async function lifetimeEarnings(user) {
  const earnings =
    (await recognitionCollection.count({ recognizee: user })) +
    (await goldenRecognitionCollection.count({ recognizee: user })) * 20;
  return earnings;
}

async function lifetimeSpendings(user) {
  const deductions = await deductionCollection.find({ user, refund: false });
  const deductionAmounts = deductions.map((x) => x.value);
  return deductionAmounts.reduce((total, num) => total + num, 0);
}

async function dailyGratitudeRemaining(user, timezone) {
  if (config.usersExemptFromMaximum.includes(user)) {
    winston.debug("current user is exempt from limits!", {
      func: "service.balance.dailyGratitudeRemaining",
      callingUser: user,
    });
    return Infinity;
  }
  const midnight = moment(Date.now()).tz(timezone).startOf("day");
  const recognitionGivenToday = await recognitionCollection.count({
    recognizer: user,
    timestamp: {
      $gte: new Date(midnight),
    },
  });

  winston.debug(
    `${user} has [${config.maximum - recognitionGivenToday}] recognitions left`,
    {
      func: "service.balance.dailyGratitudeRemaining",
      callingUser: user,
      timezone: timezone,
    }
  );

  return config.maximum - recognitionGivenToday;
}

async function respondToBalance({ message, client }) {
  winston.info("@gratibot balance Called", {
    func: "service.balance.respondToBalance",
    callingUser: message.user,
    slackMessage: message.text,
  });

  const userInfo = await client.users.info({ user: message.user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      func: "service.balance.respondToBalance",
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

  const current_balance = await currentBalance(message.user);
  const lifetime_total = await lifetimeEarnings(message.user);
  const remaining_today = await dailyGratitudeRemaining(
    message.user,
    userInfo.user.tz,
    1
  );

  const response = [
    `Your current balance is: \`${current_balance}\``,
    `Your lifetime earnings are: \`${lifetime_total}\``,
    `You have \`${remaining_today}\` left to give away today.`,
  ].join("\n");

  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: response,
  });

  winston.debug("successfully posted ephemeral balance result to Slack", {
    func: "service.balance.respondToBalance",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

module.exports = {
  currentBalance,
  lifetimeEarnings,
  lifetimeSpendings,
  dailyGratitudeRemaining,
  respondToBalance,
};
