const config = require("../config");
const moment = require("moment-timezone");

const recognitionCollection = require("../database/recognitionCollection");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const deductionCollection = require("../database/deductionCollection");

async function currentBalance(user) {
  const earning = await lifetimeEarnings(user);
  const spending = await lifetimeSpendings(user);
  return earning - spending;
}

async function lifetimeEarnings(user) {
  const earnings =
    (await recognitionCollection.count({ recognizee: user })) +
    (await goldenRecognitionCollection.count({ recognizee: user })) * 20;
  return earnings;
}

async function lifetimeSpendings(user) {
  const deductions = await deductionCollection.find({ user });
  const deductionAmounts = deductions.map((x) => x.value);
  return deductionAmounts.reduce((total, num) => total + num, 0);
}

async function dailyGratitudeRemaining(user, timezone) {
  if (config.usersExemptFromMaximum.includes(user)) {
    return Infinity;
  }
  const midnight = moment(Date.now()).tz(timezone).startOf("day");
  const recognitionGivenToday = await recognitionCollection.count({
    recognizer: user,
    timestamp: {
      $gte: new Date(midnight),
    },
  });
  return config.maximum - recognitionGivenToday;
}

module.exports = {
  currentBalance,
  lifetimeEarnings,
  lifetimeSpendings,
  dailyGratitudeRemaining,
};
