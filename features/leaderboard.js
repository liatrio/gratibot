const leaderboard = require("../service/leaderboard");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");
const { respondToUser } = require("../service/messageutils");

module.exports = function (app) {
  app.message(
    /leaderboard/i,
    anyOf(directMessage(), directMention),
    respondToLeaderboard,
  );
  app.action(/leaderboard-\d+/, updateLeaderboardResponse);
};

/*
 * Replies to a Slack user message with a leaderboard.
 * @param {object} args Bolt message listener args.
 * @param {object} args.message The incoming Slack message event.
 * @param {object} args.client A Slack WebClient instance.
 */
async function respondToLeaderboard({ message, client }) {
  winston.info("@gratibot leaderboard Called", {
    func: "feature.leaderboard.respondToLeaderboard",
    callingUser: message.user,
    slackMessage: message.text,
  });
  await respondToUser(client, message, {
    text: "Gratibot Leaderboard",
    blocks: await leaderboard.createLeaderboardBlocks(30),
  });
  winston.debug("response to leaderboard request was posted to Slack", {
    func: "feature.leaderboard.respondToLeaderboard",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

/*
 * Replies to a Slack block_action on an existing leaderboard with updated info.
 * @param {object} args Bolt action listener args.
 * @param {Function} args.ack Acknowledges the action request.
 * @param {object} args.body The full action payload.
 * @param {object} args.action The triggered action (carries the selected time range in `value`).
 * @param {Function} args.respond Replaces the original message with new content.
 */
async function updateLeaderboardResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive leaderboard button clicked", {
    func: "feature.leaderboard.updateLeaderboardResponse",
    callingUser: body.user.id,
  });

  await respond({
    blocks: await leaderboard.createLeaderboardBlocks(action.value),
  });
  winston.debug("leaderboard interactive button response posted to Slack", {
    func: "feature.leaderboard.updateLeaderboardResponse",
    callingUser: body.user.id,
  });
}
