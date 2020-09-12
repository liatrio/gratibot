const { emoji } = require('../config')
const deduction = require('../service/deduction')
const balance = require('../service/balance')
const winston = require('../winston')

module.exports = function(controller) {
    controller.hears(
        /^deduct\s+([0-9]+)(\s+.*)?$/,
        ['direct_message', 'direct_mention'],
        attemptDeduction
    );

    controller.hears(
        'deduct',
        ['direct_message', 'direct_mention'],
        failedToParseInput
    );
}

async function failedToParseInput(bot, message) {
    winston.info(
        "Heard 'deduct' but failed to parse input",
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    const response = [
        `Please specify an amount to deduct,`,
        `Ex: \`<@${message.incoming_message.recipient.id}> deduct 100 Optional Message\``,
    ].join(' ');

    await bot.replyEphemeral(
        message,
        response
    );
}

async function attemptDeduction(bot, message) {
    winston.info(
        '@gratibot deduct Called',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    const deductionValue = parseInt(message.matches[1], 10);
    const deductionMessage = message.matches[2]?.trim() | '';
    if(deductionValue <= 0) {
        return await bot.replyEphemeral(
            message,
            "You can only deduct positve numbers.",
        );
    }
    if(!isBalanceSufficent(message.user, deductionValue)) {
        return await bot.replyEphemeral(
            message,
            "Your current balance isn't high enough to deduct that much",
        );
    }
    await deduction.createDeduction(message.user, deductionValue, deductionMessage);
    return await bot.replyEphemeral(
        message,
        `Deducted ${deductionValue} from your current balance.`
    );
}

async function isBalanceSufficent(user, deductionValue) {
    return balance.currentBalance(user) >= deductionValue;
}
