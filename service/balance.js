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
    },
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

  const userDate = moment(Date.now()).tz(timezone);
  const midnight = userDate.startOf("day");
  
  // Check if it's the first Friday of the month
  const isFirstFriday = userDate.day() === 5 && // Friday is 5 in moment.js
                       userDate.date() <= 7;     // First week of the month
  
  const recognitionGivenToday = await recognitionCollection.count({
    recognizer: user,
    timestamp: {
      $gte: new Date(midnight),
    },
  });

  const dailyLimit = isFirstFriday ? config.firstFridayMaximum : config.maximum;

  winston.debug(
    `${user} has [${dailyLimit - recognitionGivenToday}] recognitions left`,
    {
      func: "service.balance.dailyGratitudeRemaining",
      callingUser: user,
      timezone: timezone,
      isFirstFriday: isFirstFriday,
    },
  );

  return dailyLimit - recognitionGivenToday;
}

module.exports = {
  currentBalance,
  lifetimeEarnings,
  lifetimeSpendings,
  dailyGratitudeRemaining,
};
