const { emoji, maximum } = require('../config')
const winston = require('../winston')

module.exports = function(controller) {
    controller.hears(
        'help',
        ['direct_message', 'direct_mention'],
        respondToHelp
    );

    controller.hears(
        ['thunderfury', 'Thunderfury'],
        ['direct_message', 'direct_mention', 'mention', 'message'],
        respondToEasterEgg,
    );
}

const helpBlocks = {
    blocks: [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: ":wave: Hi there, let's take a look at what I can do!",
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*Give Recognition*',
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    `You can give up to \`${maximum}\` recognitions per`,
                    `day.\n\nFirst, make sure I have been invited to the channel`,
                    `you want to recognize someone in.  Then, write a brief message`,
                    `describing what someone did, \`@mention\` them and include`,
                    `the ${emoji} emoji...I'll take it from there!`,
                ].join(' '),
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `> Thanks <@alice> for helping me fix my pom.xml ${emoji}`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: 'Recognize multiple people at once!',
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `> <@bob> and <@alice> crushed that showcase! ${emoji}`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: 'Use `#tags` to call out specific Liatrio values that were demonstrated.',
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `> I love the #energy in your Terraform demo <@alice>! ${emoji}`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: 'The more emojis you add, the more recognition they get.',
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    `> <@alice> just pushed the cleanest code I've ever`,
                    `seen! ${emoji} ${emoji} ${emoji}`,
                ].join(' '),
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*View Balance*',
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    "Send me a direct message with `balance` and I'll let you",
                    "know how many recognitions you have left to give and",
                    "how many you have received.",
                ].join(' '),
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    `> You have received 0 ${emoji} and you have`,
                    `${maximum} ${emoji} remaining to give away today`,
                ].join(' '),
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*View Leaderboard*',
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    "Send me a direct message with `leaderboard` and I'll",
                    "show you who is giving and receiving the most recognition.",
                ].join(' '),
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*View Metrics*',
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    "Send me a direct message with `metrics` and",
                    "I'll show you how many times people have given recognition",
                    "over the last month.",
                ].join(' '),
            },
        },
    ],
};

async function respondToHelp(bot, message) {
    winston.info(
        '@gratibot help Called',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    await bot.replyEphemeral(message, helpBlocks);
}

const thunderfuryResponse = [
    'Did someone say',
    ':thunderfury_blessed_blade_of_the_windseeker:',
    '[Thunderfury, Blessed Blade of the Windseeker]',
    ':thunderfury_blessed_blade_of_the_windseeker:?',
].join(' ')

async function respondToEasterEgg(bot, message) {
    winston.info(
        'heard reference to thunderfury',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    await bot.reply(message, thunderfuryResponse);
}
