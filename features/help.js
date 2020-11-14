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

const helpMarkdown = `
:wave: Hi there! Let's take a look at what I can do!




*Give Recognition*

You can give up to ${maximum} recognitions per day.

First, make sure I have been invited to the channel you want to recognize \
someone in. Then, write a brief message describing what someone did, \
\`@mention\` them and include the ${emoji} emoji...I'll take it from there!

> Thanks @alice for helping me fix my pom.xml ${emoji}

Recognize multiple people at once!

> @bob and @alice crushed that showcase! ${emoji}

Use \`#tags\` to call out specific Liatrio values!

> I love the #energy in your Terraform demo @alice! ${emoji}

The more emojis you add, the more recognition they get!

> @alice just pushed the cleanest code I've ever seen! ${emoji} ${emoji} ${emoji}




*View Balance*

Send me a direct message with 'balance' and I'll let you know how many \
recognitions you have left to give and how many you have received.

> You have received 0 ${emoji} and you have ${maximum} ${emoji} remaining to \
give away today




*View Leaderboard*

Send me a direct message with 'leaderboard' and I'll show you who is giving \
and receiving the most recognition.




*View Metrics*

Send me a direct message with 'metrics' and I'll show you how many times \
people have given recognition over the last month.
`

async function respondToHelp(bot, message) {
    winston.info(
        '@gratibot help Called',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    await bot.replyEphemeral(message, helpMarkdown);
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
