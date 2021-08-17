const { recognizeEmoji, maximum, reactionEmoji } = require("../config");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");

module.exports = function (app) {
  app.message("help", anyOf(directMention(), directMessage()), respondToHelp);
  app.message(/(thunderfury|Thunderfury)/, respondToEasterEgg);
};

const helpMarkdown = `
:wave: Hi there! Let's take a look at what I can do!




*Give Recognition*

You can give up to ${maximum} recognitions per day.

First, make sure I have been invited to the channel you want to recognize \
someone in. Then, write a brief message describing what someone did, \
\`@mention\` them and include the ${recognizeEmoji} emoji...I'll take it from there!

> Thanks @alice for helping me fix my pom.xml ${recognizeEmoji}

Recognize multiple people at once!

> @bob and @alice crushed that showcase! ${recognizeEmoji}

Use \`#tags\` to call out specific Liatrio values!

> I love the #energy in your Terraform demo @alice! ${recognizeEmoji}

The more emojis you add, the more recognition they get!

> @alice just pushed the cleanest code I've ever seen! ${recognizeEmoji} ${recognizeEmoji} ${recognizeEmoji}


If someone else has given a ${recognizeEmoji} to someone, and you'd like to \
give one of your own for the same reason, you can react to the message with \
a ${reactionEmoji}. Gratibot will record your shout-out as though you sent \
the same message that you reacted to.

*Redeeming*

For details about how to redeem ${recognizeEmoji} check out Confluence:

https://liatrio.atlassian.net/wiki/spaces/LE/pages/817857117/Redeeming+Fistbumps




*View Balance*

Send me a direct message with 'balance' and I'll let you know how many \
recognitions you have left to give and how many you have received.

> You have received 0 ${recognizeEmoji} and you have ${maximum} ${recognizeEmoji} remaining to \
give away today




*View Leaderboard*

Send me a direct message with 'leaderboard' and I'll show you who is giving \
and receiving the most recognition.




*View Metrics*

Send me a direct message with 'metrics' and I'll show you how many times \
people have given recognitions over the last month.




*Deduct (BETA)*

Send me a direct message with 'deduct {value}' such as 'deduct 50' and I \
will remove that number of ${recognizeEmoji} from your total. You can use \
this to track when you've redeemed prizes.

Note: This feature is still in beta. Deductions are difficult to undo if they \
are done by accident. No permanent harm should be done by mistaken deductions \
but be careful. As this is a beta feature, deductions may be wiped in the future.
`;

async function respondToHelp({ message, client }) {
  winston.info("@gratibot help Called", {
    func: "feature.help.respondToHelp",
    callingUser: message.user,
    slackMessage: message.text,
  });
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: helpMarkdown,
  });

  winston.debug("successfully posted ephemeral help message to Slack", {
    func: "feature.help.respondToHelp",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

const thunderfuryResponse = [
  "Did someone say",
  ":thunderfury_blessed_blade_of_the_windseeker:",
  "[Thunderfury, Blessed Blade of the Windseeker]",
  ":thunderfury_blessed_blade_of_the_windseeker:?",
].join(" ");

async function respondToEasterEgg({ message, say }) {
  winston.info("heard reference to thunderfury", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  await say(thunderfuryResponse);

  winston.debug("successfully posted thunderfury message to Slack", {
    func: "feature.help.respondToEasterEgg",
    callingUser: message.user,
    slackMessage: message.text,
  });
}
