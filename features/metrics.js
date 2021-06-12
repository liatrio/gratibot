const metrics = require("../service/metrics");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "metrics",
    anyOf(directMessage(), directMention()),
    respondToMetrics
  );
  app.action(/metrics-\d+/, updateMetricsResponse);
};

async function respondToMetrics({ message, client }) {
  winston.info("@gratibot metrics Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Gratibot Metrics",
    blocks: await metrics.createMetricsBlocks(30),
  });
}

async function updateMetricsResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive metrics button clicked", {
    callingUser: body.user.id,
  });

  await respond({
    blocks: await metrics.createMetricsBlocks(action.value),
  });
}
