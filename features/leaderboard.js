const leaderboard = require("../service/leaderboard");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "leaderboard",
    anyOf(directMessage(), directMention()),
    respondToLeaderboard
  );
  app.action(/leaderboard-\d+/, updateLeaderboardResponse);
};

/*
 * Replies to a Slack user message with a leaderboard.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering.
 *     this call.
 */
async function respondToLeaderboard({ message, client }) {
  winston.info("@gratibot leaderboard Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Gratibot Leaderboard",
    blocks: await leaderboard.createLeaderboardBlocks(30),
  });
}

/*
 * Replies to a Slack block_action on an existing leaderboard with updated info.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering
 *     this call.
 */
async function updateLeaderboardResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive leaderboard button clicked", {
    callingUser: body.user.id,
  });

  await respond({
    blocks: await leaderboard.createLeaderboardBlocks(action.value),
  });
}
