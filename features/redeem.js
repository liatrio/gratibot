const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const { respondToUser } = require("../service/messageutils");
const redeem = require("../service/redeem");
const balance = require("../service/balance");
const deduction = require("../service/deduction");

module.exports = function (app) {
  app.message(/redeem/i, anyOf(directMention, directMessage), respondToRedeem);
  app.action({ action_id: "redeem" }, redeemItem);
};

async function respondToRedeem({ message, client }) {
  winston.info("@gratibot redeem Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });
  const [currentBalance, rewards] = await Promise.all([
    balance.currentBalance(message.user),
    redeem.fetchActiveRewards(),
  ]);
  await respondToUser(client, message, {
    text: "Gratibot Rewards",
    blocks: redeem.buildRedeemBlocks(rewards, currentBalance),
  });
}

async function redeemItem({ ack, body, context, client }) {
  await ack();
  const userID = body.user.id;
  try {
    const rewardId = body.actions[0].selected_option.value;
    const reward = await redeem.fetchActiveRewardById(rewardId);
    if (!reward) {
      return client.chat.postEphemeral({
        channel: body.channel.id,
        user: userID,
        text: "That reward is no longer available. Send `redeem` again to see the current list.",
      });
    }

    const { name, cost, kind } = reward;

    let redemptionMessage = `<@${userID}> has selected ${name}`;
    if (kind === "liatrio-store") {
      if (!(await deduction.isBalanceSufficient(userID, cost))) {
        return client.chat.postEphemeral({
          channel: body.channel.id,
          user: userID,
          text: "Your current balance isn't high enough to deduct that much",
        });
      }
      const result = await client.conversations.open({
        token: context.botToken,
        users: redeem.redeemNotificationUsers(userID),
      });
      redemptionMessage += `. Please provide the link of the item from the <https://liatrio.axomo.com/|Liatrio Store>.`;
      await client.chat.postMessage({
        channel: result.channel.id,
        token: context.botToken,
        text: redemptionMessage,
      });
    } else {
      const operationId = `reward:${body.actions[0].action_ts || rewardId}`;
      const lockResult = await deduction.acquireLock(userID, operationId);
      if (!lockResult.acquired) {
        const text =
          lockResult.reason === "stadium-review"
            ? "A Stadium redemption is awaiting admin review. You can redeem another reward after it is resolved."
            : "You already have a redemption in progress. Please try again shortly.";
        return client.chat.postEphemeral({
          channel: body.channel.id,
          user: userID,
          text,
        });
      }
      try {
        if (!(await deduction.isBalanceSufficient(userID, cost))) {
          return client.chat.postEphemeral({
            channel: body.channel.id,
            user: userID,
            text: "Your current balance isn't high enough to deduct that much",
          });
        }
        const result = await client.conversations.open({
          token: context.botToken,
          users: redeem.redeemNotificationUsers(userID),
        });
        redemptionMessage += ` for ${cost} fistbumps.`;
        const deductionID = await deduction.createDeduction(
          userID,
          cost,
          redemptionMessage,
        );
        redemptionMessage += ` Deduction ID is \`${deductionID}\``;
        await client.chat.postMessage({
          channel: result.channel.id,
          token: context.botToken,
          text: redemptionMessage,
        });
      } finally {
        await deduction.releaseLock(userID, operationId);
      }
    }
  } catch (error) {
    winston.error("redeemItem failed", {
      func: "feature.redeem.redeemItem",
      callingUser: userID,
      error: error.message,
    });
    try {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userID,
        text: "Something went wrong processing your redemption. Please try again or contact an admin.",
      });
    } catch {
      // best-effort; nothing more we can do
    }
  }
}
