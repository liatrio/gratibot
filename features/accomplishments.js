const accomplishments = require("../service/accomplishments");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "accomplishments",
    anyOf(directMessage(), directMention),
    respondToAccomplishments,
  );
  app.action(/accomplishments-\d+/, updateAccomplishmentsResponse);
};

/**
 * Replies to a Slack user message with their accomplishments (recognitions received).
 * @param {object} param0 Object containing message and client
 */
async function respondToAccomplishments({ message, client }) {
  winston.info("@gratibot accomplishments Called", {
    func: "feature.accomplishments.respondToAccomplishments",
    callingUser: message.user,
    slackMessage: message.text,
  });
  
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Your Accomplishments",
    blocks: await accomplishments.createAccomplishmentsBlocks(message.user, 30),
  });
  
  winston.debug("response to accomplishments request was posted to Slack", {
    func: "feature.accomplishments.respondToAccomplishments",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

/**
 * Updates an existing accomplishments message with a different time range.
 * @param {object} param0 Object containing ack, body, action, and respond functions
 */
async function updateAccomplishmentsResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive accomplishments button clicked", {
    func: "feature.accomplishments.updateAccomplishmentsResponse",
    callingUser: body.user.id,
  });

  await respond({
    blocks: await accomplishments.createAccomplishmentsBlocks(body.user.id, action.value),
  });
  
  winston.debug("accomplishments interactive button response posted to Slack", {
    func: "feature.accomplishments.updateAccomplishmentsResponse",
    callingUser: body.user.id,
  });
}
