const moment = require('moment-timezone');
const { maximum } = require('../config')

const recognitionCollection = require('../database/recognitionCollection');
const deductionCollection = require('../database/deductionCollection');

async function currentBalance(user) {
    const earning = await lifetimeEarnings(user);
    const spending = await lifetimeSpendings(user);
    return earning - spending;
}

async function lifetimeEarnings(user) {
    return recognitionCollection.count({ recognizee: user });
}

async function lifetimeSpendings(user) {
    const deductions = await deductionCollection.find({ user });
    const deductionAmounts = deductions.map(x => x.value);
    return deductionAmounts.reduce((total, num) => total + num, 0);
}

async function dailyGratitudeRemaining(user, timezone) {
    const midnight = moment(Date.now())
        .tz(timezone)
        .startOf('day')
    const recognitionGivenToday = await recognitionCollection.count({
        recognizer: user,
        timestamp: {
            $gte: new Date(midnight),
        },
    });
    return maximum - recognitionGivenToday;
}

module.exports = {
    currentBalance,
    lifetimeEarnings,
    lifetimeSpendings,
    dailyGratitudeRemaining,
}
