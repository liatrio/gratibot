const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const redeem = require("../service/redeem");

module.exports = function (app) {
  app.message("redeem", anyOf(directMention(), directMessage()), respondToRedeem);
  app.action({ action_id: 'redeem' },
  async ({ action, ack, body, context }) => {
    await ack();
    try {
      console.log("ACTION!!!");

      const result = await app.client.conversations.open({
        token: context.botToken,
        users: `${body.user.id}, U014N0A0CHZ`,
      });
      const result2 = await app.client.conversations.list({
        token: context.botToken,
        types: "mpim, im",
      });
      const result3 = await app.client.chat.postMessage({
        channel: result.channel.id,  
        token: context.botToken,
        text: "TESTING MESSAGE FROM BOT",
      });
      console.log(result);
      console.log(result2);
    }
    catch (error) {
      console.error(error);
    }
  });
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
