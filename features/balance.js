//const { emoji, maximum } = require('../config')
const balance = require('../service/balance');

module.exports = function(controller) {
    controller.hears(
        'balance',
        ['direct_message', 'direct_mention'],
        respondToBalance,
    );
}

async function respondToBalance(bot, message) {
    // TODO: Error Handling
    const userInfo = await bot.api.users.info({user: message.user }).user;
    const currentBalance = await balance.currentBalance(message.user);
    const lifetimeTotal = await balance.lifetimeEarnings(message.user);
    const remainingToday = await balance.dailyGratitudeRemaining(
        message.user,
        userInfo.tz,
        1,
    )

    const response = [
        `Your current balance is: \`${currentBalance}\``,
        `Your lifetime earnings are: \`${lifetimeTotal}\``,
        `You have \`${remainingToday}\` left to give away today.`
    ].join('\n');

    await bot.replyEphemeral(
        message,
        response,
    );
}
