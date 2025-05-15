const influencers = require("../service/influencers");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "influencers",
    anyOf(directMessage(), directMention),
    respondToInfluencers,
  );
  app.action(/influencers-\d+/, updateInfluencersResponse);
};

/**
 * Replies to a Slack user message with the most influential recognitions.
 * @param {object} param0 Object containing message and client
 */
async function respondToInfluencers({ message, client }) {
  winston.info("@gratibot influencers Called", {
    func: "feature.influencers.respondToInfluencers",
    callingUser: message.user,
    slackMessage: message.text,
  });
  
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Top Influential Recognitions",
    blocks: await influencers.createInfluencersBlocks(30),
  });
  
  winston.debug("response to influencers request was posted to Slack", {
    func: "feature.influencers.respondToInfluencers",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

/**
 * Updates an existing influencers message with a different time range.
 * @param {object} param0 Object containing ack, body, action, and respond functions
 */
async function updateInfluencersResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive influencers button clicked", {
    func: "feature.influencers.updateInfluencersResponse",
    callingUser: body.user.id,
  });

  await respond({
    blocks: await influencers.createInfluencersBlocks(action.value),
  });
  
  winston.debug("influencers interactive button response posted to Slack", {
    func: "feature.influencers.updateInfluencersResponse",
    callingUser: body.user.id,
  });
}
