const {
  recognizeEmoji,
  maximum,
  reactionEmoji,
  goldenRecognizeEmoji,
} = require("../config");
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

Recognize an entire group!

> @bengal did an excellent job on the presentation! ${recognizeEmoji}

Use \`#tags\` to call out specific Liatrio values!

> I love the #energy in your Terraform demo @alice! ${recognizeEmoji}

You can give more recognition by adding more emojis...

> @alice just pushed the cleanest code I've ever seen! ${recognizeEmoji} ${recognizeEmoji} ${recognizeEmoji}

Or by using a multiplier!

> @alice just pushed the cleanest code I've ever seen! ${recognizeEmoji} x3


If someone else has given a ${recognizeEmoji} to someone, and you'd like to \
give one of your own for the same reason, you can react to the message with \
a ${reactionEmoji}. Gratibot will record your shout-out as though you sent \
the same message that you reacted to.

*Redeeming*


Send me a direct message with 'redeem' and I'll give you the options for prizes to redeem! Once you've selcted an item then I'll start a MPIM with the redemption admins to promote the dialog to acknowledge and receive your item.

Refunds can be given via the 'refund' command if the item redeem can't be fulfilled for whatever reason. Only redemption admins can give refunds. Deduction ID is sent as part of the MPIM when an item is redeemed

> @gratibot refund DEDUCTIONID


*View Balance*

Send me a direct message with 'balance' and I'll let you know how many \
recognitions you have left to give and how many you have received.

> You have received 0 ${recognizeEmoji} and you have ${maximum} ${recognizeEmoji} remaining to \
give away today




*View Leaderboard*

Send me a direct message with 'leaderboard' and I'll show you who is giving \
and receiving the most recognition. I'll also show who currently holds the :goldenfistbump:!




*View Metrics*

Send me a direct message with 'metrics' and I'll show you how many times \
people have given recognitions over the last month.


*Give Golden Recognition*

The golden fistbump :goldenfistbump: is a special recognition that can only be held by one user at a time. Only the current holder of the golden recognition can give the golden recognition.

Giving a golden fistbump is the same as giving a normal fistbump

> Thanks @alice for helping fix the prod issues! ${goldenRecognizeEmoji}

Upon receiving the golden fistbump, the user will receive 20 fistbumps and will have a 2X multiplier applied to all incoming fistbumps while the golden fistbump is held. 
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
