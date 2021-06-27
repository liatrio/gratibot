const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const redeem = require("../service/redeem");

module.exports = function (app) {
  app.message("redeem", anyOf(directMention(), directMessage()), respondToRedeem);
};

async function respondToRedeem({ message, client }) {
  winston.info("@gratibot redeem Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Gratibot Rewards",
    blocks: await redeem.createRedeemBlocks(message.user),
  });
}
