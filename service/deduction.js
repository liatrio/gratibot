const winston = require("../winston");
const moment = require("moment-timezone");
const balance = require("../service/balance");
const deductionCollection = require("../database/deductionCollection");
const { userRegex } = require("../regex");
const { redemptionAdmins } = require("../config");
const monk = require("monk");
const { winstonInfo, winstonError } = require("./apiwrappers");

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
  winstonInfo(
    "@gratibot refund Called",
    "service.deduction.respondToRefund",
    message
  );

  if (!admins.includes(message.user)) {
    await sendMessage(
      client,
      message.channel,
      message.user,
      "Only `Redemption Admins` can use the refund command"
    );
    return;
  }

  try {
    const result = await refundDeduction(message.text.split(" ")[2]);

    if (result) {
      await sendMessage(
        client,
        message.channel,
        message.user,
        "Refund Successfully given"
      );
    } else {
      await sendMessage(
        client,
        message.channel,
        message.user,
        "Deduction not found or refund failed"
      );
    }
  } catch (error) {
    console.error("Refund error:", error);
    await sendMessage(
      client,
      message.channel,
      message.user,
      "An error occurred while processing the refund"
    );
  }
}

async function respondToDeduction({ message, client }) {
  winstonInfo(
    "@gratibot deduction Called",
    "service.deduction.respondToDeduction",
    message
  );

  const userInfo = await client.users.info({ user: message.user });
  if (!userInfo.ok) {
    winstonError(
      "Slack API returned error from users.info",
      "service.deduction.respondToDeduction",
      message,
      userInfo
    );
    await sendEphemeralMessage(
      client,
      message.channel,
      message.user,
      `Something went wrong while creating your deduction. When retreiving user information from Slack, the API responded with the following error: ${userInfo.error}`
    );
    return;
  }

  if (!redemptionAdmins.includes(message.user)) {
    await sendEphemeralMessage(
      client,
      message.channel,
      message.user,
      `You are not allowed to create deductions.`
    );
    return;
  }

  const messageText = message.text.split(" ");

  if (
    messageText.length < 4 ||
    !userRegex.test(messageText[2]) ||
    isNaN(+messageText[3])
  ) {
    await sendEphemeralMessage(
      client,
      message.channel,
      message.user,
      `You must specify a user and value to deduct. Example: \`@gratibot deduct @user 5\``
    );
    return;
  }

  const user = messageText[2].match(userRegex)[1];
  const value = +messageText[3];

  if (!(await isBalanceSufficent(user, value))) {
    await sendEphemeralMessage(
      client,
      message.channel,
      message.user,
      `<@${user}> does not have a large enough balance to deduct ${value} fistbumps.`
    );
    return;
  }

  const deductionInfo = await createDeduction(user, value, message.text);

  await sendMessage(
    client,
    message.channel,
    message.user,
    `A deduction of ${value} fistbumps has been made for <@${user}>. Deduction ID is \`${deductionInfo._id}\``
  );
}

async function sendMessage(client, channel, user, text) {
  await client.chat.postMessage({
    channel,
    user,
    text,
  });
}

async function sendEphemeralMessage(client, channel, user, text) {
  await client.chat.postEphemeral({
    channel,
    user,
    text,
  });
}

module.exports = {
  createDeduction,
  refundDeduction,
  getDeductions,
  isBalanceSufficent,
  respondToRefund,
  respondToDeduction,
  sendMessage,
  sendEphemeralMessage,
};
