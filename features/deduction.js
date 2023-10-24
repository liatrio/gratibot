const deduction = require("../service/deduction");
const winston = require("../winston");
const { redemptionAdmins } = require("../config");
const { userRegex } = require("../regex");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "deduct",
    anyOf(directMention(), directMessage()),
    respondToDeduction
  );
};

async function respondToDeduction({ message, client }) {
  winston.info("@gratibot deduction Called", {
    func: "feature.deduction.respondToDeduction",
    callingUser: message.user,
    slackMessage: message.text,
  });

  const userInfo = await client.users.info({ user: message.user });
  if (!userInfo.ok) {
    winston.error("Slack API returned error from users.info", {
      func: "feature.deduction.respondToDeduction",
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

  if (!(await deduction.isBalanceSufficent(user, value))) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `<@${user}> does not have a large enough balance to deduct ${value} fistbumps.`,
    });
    return;
  }

  const deductionInfo = await deduction.createDeduction(
    user,
    value,
    message.text
  );

  await client.chat.postMessage({
    channel: message.channel,
    user: message.user,
    text: `A deduction of ${value} fistbumps has been made for <@${user}>. Deduction ID is \`${deductionInfo._id}\``,
  });
}
