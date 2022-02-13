const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const redeem = require("../service/redeem");

module.exports = function (app) {
  app.message("redeem", anyOf(directMention(), directMessage()), respondToRedeem);
  app.action({ action_id: 'redeem' }, redeemItem);
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

async function redeemItem({ action, ack, body, context, client }) {
  await ack();
  try {
    const result = await client.conversations.open({
      token: context.botToken,
      users: redeem.createMPIM(body.user.id),
    });
    const result2 = await client.conversations.list({
      token: context.botToken,
      types: "mpim, im",
    });
    const { itemName, itemCost } = redeem.getSelectedItemDetails(body.actions[0].selected_option.value);
    const result3 = await client.chat.postMessage({
      channel: result.channel.id,  
      token: context.botToken,
      text: `<@${body.user.id}> has redeemed ${itemName} for ${itemCost} fistbumps`,
    });
    // Create deduction
  }
  catch (error) {
    console.error(error);
  }
}
