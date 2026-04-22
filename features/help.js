const {
  recognizeEmoji,
  maximum,
  reactionEmoji,
  goldenRecognizeEmoji,
} = require("../config");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const { respondToUser } = require("../service/messageutils");

module.exports = function (app) {
  app.message(/help/i, anyOf(directMention, directMessage), respondToHelp);
  app.message(/(thunderfury|Thunderfury)/, respondToEasterEgg);
};

const divider = "━━━━━━━━━━━━━━━━━━━━";

const helpMarkdown = `
:wave: Hi there! Here's what I can do.

${divider}

*Give Recognition* (up to ${maximum} per day)

Invite me to the channel, then mention someone, describe what they did, and add ${recognizeEmoji}.

> Thanks @alice for helping me fix my pom.xml ${recognizeEmoji}

• Recognize multiple people at once — \`@bob and @alice crushed the showcase! ${recognizeEmoji}\`
• Tag Liatrio values with \`#tags\` — \`I love the #energy in your demo @alice! ${recognizeEmoji}\`
• Boost with extra emoji or a multiplier — \`${recognizeEmoji} ${recognizeEmoji} ${recognizeEmoji}\` or \`${recognizeEmoji} x2\`
• Second someone else's shout-out by reacting with ${reactionEmoji}

${divider}

*Golden Fistbump* ${goldenRecognizeEmoji}

Only the current holder can pass it on. Use it like any other fistbump:

> Thanks @alice for fixing prod! ${goldenRecognizeEmoji}

The new holder receives 20 ${recognizeEmoji} immediately, plus a 2x multiplier on all recognition they receive while holding it.

${divider}

*Check Your Status* (DM me one of these)

• \`balance\` — how many ${recognizeEmoji} you've received and have left to give today
• \`leaderboard\` — top givers, top receivers, and the current ${goldenRecognizeEmoji} holder
• \`metrics\` — recognition activity over the last month
• \`report\` — your top reasons for recognition over the past month, six months, or year. Use \`report @user\` to view someone else's — handy for biannual reviews.

${divider}

*Redeem Rewards*

DM me \`redeem\` to browse prizes. Once you pick one, I'll loop in a redemption admin to finalize it.

If a redemption can't be fulfilled, admins can refund it using the deduction ID from the redemption message:

> @gratibot refund DEDUCTIONID
`;

async function respondToHelp({ message, client }) {
  winston.info("@gratibot help Called", {
    func: "feature.help.respondToHelp",
    callingUser: message.user,
    slackMessage: message.text,
  });
  await respondToUser(client, message, { text: helpMarkdown });

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
