const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const redeem = require("../service/redeem");
const balance = require("../service/balance");
const deduction = require("../service/deduction");

module.exports = function (app) {
  app.message(
    "redeem",
    anyOf(directMention(), directMessage()),
    respondToRedeem
  );
  app.action({ action_id: "redeem" }, redeemItem);
};

async function respondToRedeem({ message, client }) {
  winston.info("@gratibot redeem Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  const currentBalance = await balance.currentBalance(message.user);
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Gratibot Rewards",
    blocks: await redeem.createRedeemBlocks(currentBalance),
  });
}

async function redeemItem({ ack, body, context, client }) {
  await ack();
  const userID = body.user.id;
  try {
    const result = await client.conversations.open({
      token: context.botToken,
      users: redeem.createMPIM(userID),
    });
    await client.conversations.list({
      token: context.botToken,
      types: "mpim, im",
    });
    const { itemName, itemCost } = redeem.getSelectedItemDetails(
      body.actions[0].selected_option.value
    );
    if (!(await deduction.isBalanceSufficent(userID, itemCost))) {
      return client.chat.postEphemeral({
        channel: body.channel.id,
        user: userID,
        text: "Your current balance isn't high enough to deduct that much",
      });
    }

    let redemptionMessage = `<@${userID}> has redeemed ${itemName} for ${itemCost} fistbumps.`;
    const deductionInfo = await deduction.createDeduction(
      userID,
      itemCost,
      redemptionMessage
    );
    redemptionMessage += ` Deduction ID is \`${deductionInfo._id}\``;

    console.log(deductionInfo);
    await client.chat.postMessage({
      channel: result.channel.id,
      token: context.botToken,
      text: redemptionMessage,
    });
  } catch (error) {
    console.error(error);
  }
}
