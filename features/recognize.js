const config = require("../config");
const recognition = require("../service/recognition");
const balance = require("../service/balance");
const winston = require("../winston");

const { recognizeEmoji, maximum, minimumMessageLength, reactionEmoji } = config;

module.exports = function (controller) {
  controller.hears(
    recognizeEmoji,
    ["direct_message", "direct_mention", "mention", "message"],
    respondToRecognitionMessage
  );

  controller.on("reaction_added", respondToRecognitionReaction);
};

async function respondToRecognitionMessage(bot, message) {
  winston.info(`Heard reference to ${recognizeEmoji}`, {
    callingUser: message.user,
    slackMessage: message.text,
  });

  let userInfo;
  try {
    userInfo = await userDetails(bot, message.text, message.user);
  } catch (err) {
    winston.error("Slack API returned error from users.info", {
      callingUser: message.user,
      slackMessage: message.text,
      error: err.message,
    });
    await bot.replyEphemeral(
      message,
      `Something went wrong while sending recognition. When retreiving user information from Slack, the API responded with the following error: ${err.message} \n Recognition has not been sent.`
    );
    return;
  }
  const gratitude = {
    ...userInfo,
    count: recognition.gratitudeCountIn(message.text),
    message: message.text,
    trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
    channel: message.channel,
    tags: recognition.gratitudeTagsIn(message.text),
  }

  await validateAndSendRecognition(bot, message, gratitude);
}

async function respondToRecognitionReaction(bot, message) {
  if (
    !message.reaction.includes(reactionEmoji.slice(1, -1)) ||
    message.item.type !== "message"
  ) {
    return;
  }

  winston.info(`Saw a reaction containing ${reactionEmoji}`, {
    callingUser: message.user,
    reactionEmoji: message.reaction,
  });

  // TODO: Error handle this API call
  // Consider refactoring API calls for standardized error handling
  const messageReactedTo = (
    await bot.api.conversations.replies({
      channel: message.item.channel,
      ts: message.item.ts,
      limit: 1,
    })
  ).messages[0];

  if (!messageReactedTo.text.includes(recognizeEmoji)) {
    return;
  }

  let userInfo;
  try {
    userInfo = await userDetails(bot, messageReactedTo.text, message.user);
  } catch (err) {
    winston.error("Slack API returned error from users.info", {
      callingUser: message.user,
      slackMessage: message.text,
      APIResponse: err.message,
    });
    await bot.replyEphemeral(
      message,
      `Something went wrong while sending recognition. When retreiving user information from Slack, the API responded with the following error: ${err.message} \n Recognition has not been sent.`
    );
    return;
  }

  const gratitude = {
    ...userInfo,
    count: recognition.gratitudeCountIn(messageReactedTo.text),
    message: messageReactedTo.text,
    trimmedMessage: recognition.trimmedGratitudeMessage(messageReactedTo.text),
    channel: messageReactedTo.channel,
    tags: recognition.gratitudeTagsIn(messageReactedTo.text),
  }

  await validateAndSendRecognition(bot, message, gratitude);
}

async function userDetails(bot, messageText, giver) {
  const userIds = recognition.gratitudeReceiverIdsIn(messageText);

  const userInfo = {
    giver: await singleUserDetails(bot, giver),
    receivers: await Promise.all(
      userIds.map(async (receiver) => singleUserDetails(bot, receiver))
    ),
  };

  return userInfo;
}

// TODO: Consider refactoring API calls for standardized error handling
async function singleUserDetails(bot, userId) {
  const singleUserInfo = await bot.api.users.info({ user: userId });
  if (singleUserInfo.ok) {
    return singleUserInfo.user;
  }
  throw new Error(singleUserInfo.error);
}

async function validateAndSendRecognition(
  bot,
  message,
  gratitude
) {
  const errors = await recognition.gratitudeErrors(gratitude);
  if (errors) {
    await bot.replyEphemeral(
      message,
      [
        `Sending ${recognizeEmoji} failed with the following error(s):`,
        errors,
      ].join("\n")
    );
    return;
  }

  await recognition.giveGratitude(gratitude);

  const gratitudeRemaining = await balance.dailyGratitudeRemaining(
    gratitude.giver.id,
    gratitude.giver.tz
  );

  return Promise.all([
    sendNotificationToReceivers(bot, message, gratitude),
    bot.replyEphemeral(
      message,
      `Your ${recognizeEmoji} has been sent. You have \`${gratitudeRemaining}\` left to give today.`
    ),
  ]);
}

async function sendNotificationToReceivers(
  bot,
  message,
  gratitude
) {
  const emojiCount = recognition.gratitudeCountIn(gratitude.message);
  for (let i = 0; i < gratitude.receivers.length; i++) {
    const numberRecieved = await recognition.countRecognitionsReceived(
      gratitude.receivers[i].id
    );
    await bot.startPrivateConversation(gratitude.receivers[i].id);
    await bot.say({
      text: `You just got recognized by <@${gratitude.giver.id}> in <#${gratitude.channel}> and your new balance is \`${numberRecieved}\`\n>>>${gratitude.message}`,
    });
    if (emojiCount === numberRecieved) {
      await bot.say({
        text: `I noticed this is your first time receiving a ${recognizeEmoji}. Check out <https://liatrio.atlassian.net/wiki/spaces/LE/pages/817857117/Redeeming+Fistbumps|Confluence> to see what they can be used for, or try running \`<@${message.incoming_message.recipient.id}> help\` for more information about me.`,
      });
    }
  }
}
