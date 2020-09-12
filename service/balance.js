const recognitionCollection = require('../database/recognitionCollection');
const deductionCollection = require('../database/deductionCollection');

async function currentBalance(user) {
    const earning = await lifetimeEarnings(user);
    const spending = await lifetimeSpendings(user);
    return earning - spending;
}

async function lifetimeEarnings(user) {
    return await recognitionCollection.count({ recognizee: user });
}

async function lifetimeSpendings(user) {
    const deductions = await deductionCollection.find({ user });
    const deductionAmounts = deductions.map(x => x.value);
    return deductionAmounts.reduce((total, num) => total + num, 0);
}

async function dailyGratitudeRemaining(user, timezone, days) {
    return 0;
    // TODO
}

module.exports = {
    currentBalance,
    lifetimeEarnings,
    lifetimeSpendings,
    dailyGratitudeRemaining,
}
