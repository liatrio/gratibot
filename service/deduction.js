const winston = require("../winston");
const moment = require("moment-timezone");
const balance = require("../service/balance");
const deductionCollection = require("../database/deductionCollection");
const { userRegex } = require("../regex");
const { redemptionAdmins } = require("../config");
const monk = require("monk");

async function createDeduction(user, value, message = "") {
  let timestamp = new Date();
  let refund = false;

  winston.debug("creating new deduction", {
    func: "service.deduction.createDeduction",
    callingUser: user,
    deductionValue: value,
  });

  return await deductionCollection.insert({
    user,
    timestamp,
    refund,
    value: Number(value),
    message,
  });
}

async function refundDeduction(id) {
  return await deductionCollection.findOneAndUpdate(
    { _id: monk.id(id) },
    { $set: { refund: true } }
  );
}

async function getDeductions(user, timezone = null, days = null) {
  let filter = { user };
  if (days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf("day");
    midnight = midnight.subtract(days - 1, "days");
    filter.timestamp = {
      $gte: new Date(midnight),
    };
  }

  winston.debug(`retrieving ${user}'s deductions`, {
    func: "service.deduction.createDeduction",
    callingUser: user,
    timezone: timezone,
    days: days,
  });

  return await deductionCollection.find(filter);
}

async function isBalanceSufficent(user, deductionValue) {
  return (await balance.currentBalance(user)) >= deductionValue;
}

async function respondToRefund({ message, client, admins = redemptionAdmins }) {
  winston.info("@gratibot refund Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  const messageText = message.text.split(" ");

  if (admins.includes(message.user)) {
    try {
      const result = await refundDeduction(messageText[2]);

      if (result) {
        await client.chat.postMessage({
          channel: message.channel,
          user: message.user,
          text: "Refund Successfully given",
        });
      } else {
        await client.chat.postMessage({
          channel: message.channel,
          user: message.user,
          text: "Deduction not found or refund failed",
        });
      }
    } catch (error) {
      // Handle any errors that occur during the refund operation
      console.error("Refund error:", error);
      await client.chat.postMessage({
        channel: message.channel,
        user: message.user,
        text: "An error occurred while processing the refund",
      });
    }
  } else {
    await client.chat.postMessage({
      channel: message.channel,
      user: message.user,
      text: "Only `Redemption Admins` can use the refund command",
    });
  }
}

async function respondToDeduction({ message, client }) {
  winston.info("@gratibot deduction Called", {
    func: "service.deduction.respondToDeduction",
    callingUser: message.user,
    slackMessage: message.text,
  });

  const userInfo = await client.users.info({ user: message.user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      func: "service.deduction.respondToDeduction",
      callingUser: message.user,
      slackMessage: message.text,
      error: userInfo.error,
    });
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `Something went wrong while creating your deduction. When retreiving user information from Slack, the API responded with the following error: ${userInfo.error}`,
    });
    return;
  }

  if (!redemptionAdmins.includes(message.user)) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `You are not allowed to create deductions.`,
    });
    return;
  }

  const messageText = message.text.split(" ");

  if (
    messageText.length < 4 ||
    !userRegex.test(messageText[2]) ||
    isNaN(+messageText[3])
  ) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `You must specify a user and value to deduct. Example: \`@gratibot deduct @user 5\``,
    });
    return;
  }

  const user = messageText[2].match(userRegex)[1];
  const value = +messageText[3];

  if (!(await isBalanceSufficent(user, value))) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `<@${user}> does not have a large enough balance to deduct ${value} fistbumps.`,
    });
    return;
  }

  const deductionInfo = await createDeduction(user, value, message.text);

  await client.chat.postMessage({
    channel: message.channel,
    user: message.user,
    text: `A deduction of ${value} fistbumps has been made for <@${user}>. Deduction ID is \`${deductionInfo._id}\``,
  });
}

module.exports = {
  createDeduction,
  refundDeduction,
  getDeductions,
  isBalanceSufficent,
  respondToRefund,
  respondToDeduction,
};
