const {
  recognizeEmoji,
  maximum,
  minimumMessageLength,
  usersExemptFromMaximum,
  reactionEmoji,
} = require("../config");
const recognition = require("../service/recognition");
const balance = require("../service/balance");
const winston = require("../winston");

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const recognizeEmojiRegex = new RegExp(recognizeEmoji, "g");

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
    //TODO Error handing
  }

  const recognitionInfo = {
    text: message.text,
    channel: message.channel,
  };

  await validateAndSendRecognition(bot, message, recognitionInfo, userInfo);
}

async function respondToRecognitionReaction(bot, message) {
  if (
    !message.reaction.includes(reactionEmoji) ||
    message.item.type !== "message"
  ) {
    return;
  }

  winston.info(`Saw a reaction containing ${reactionEmoji}`, {
    callingUser: message.user,
    reactionEmoji: message.reaction,
  });

  const messageReactedTo = (
    await bot.api.conversations.history({
      channel: message.item.channel,
      latest: message.item.ts,
      limit: 1,
      inclusive: true,
    })
  ).messages[0];

  let userInfo;
  try {
    userInfo = await userDetails(bot, messageReactedTo.text, message.user);
  } catch (err) {
    //TODO Error handing
  }
  const recognitionInfo = {
    text: messageReactedTo.text,
    channel: message.channel,
  };

  await validateAndSendRecognition(bot, message, recognitionInfo, userInfo);
}

async function userDetails(bot, messageText, giver) {
  const userStrings = messageText.match(userRegex) || [];
  const userIds = userStrings.map((user) => user.slice(2, -1));

  const userInfo = {
    giver: await singleUserDetails(bot, giver),
    receivers: await Promise.all(
      userIds.map(async (receiver) => singleUserDetails(bot, receiver))
    ),
  };

  return userInfo;
}

async function singleUserDetails(bot, userId) {
  const singleUserInfo = await bot.api.users.info({ user: userId });
  if (singleUserInfo.ok) {
    return singleUserInfo.user;
  }
  // TODO Create a better type for this error (Is currently string)
  throw singleUserInfo.error;
}

async function validateAndSendRecognition(
  bot,
  message,
  recognitionInfo,
  userInfo
) {
  const errors = await checkForRecognitionErrors(
    recognitionInfo.text,
    userInfo
  );
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

  await sendRecognition(recognitionInfo, userInfo);

  const gratitudeRemaining = await balance.dailyGratitudeRemaining(
    userInfo.giver.id,
    userInfo.giver.tz
  );

  return Promise.all([
    sendNotificationToReceivers(bot, recognitionInfo, userInfo),
    bot.replyEphemeral(
      message,
      `Your ${recognizeEmoji} has been sent. You have ${gratitudeRemaining} left to give today.`
    ),
  ]);
}

async function checkForRecognitionErrors(messageText, userInfo) {
  const trimmedMessage = messageText
    .replace(userRegex, "")
    .replace(generalEmojiRegex, "");

  return [
    userInfo.receivers.length === 0
      ? "- Mention who you want to recognize with @user"
      : "",
    userInfo.receivers.find((x) => x.id == userInfo.giver.id)
      ? "- You can't recognize yourself"
      : "",
    userInfo.giver.is_bot ? "- Bots can't give recognition" : "",
    userInfo.giver.is_restricted ? "- Guest users can't give recognition" : "",
    userInfo.receivers.find((x) => x.is_bot)
      ? "- You can't give recognition to bots"
      : "",
    userInfo.receivers.find((x) => x.is_restricted)
      ? "- You can' give recognition to guest users"
      : "",
    trimmedMessage.length < minimumMessageLength
      ? `- Your message must be at least ${minimumMessageLength} characters`
      : "",
    !(await isRecognitionWithinSpendingLimits(messageText, userInfo))
      ? `- A maximum of ${maximum} ${recognizeEmoji} can be sent per day`
      : "",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

async function isRecognitionWithinSpendingLimits(messageText, userInfo) {
  if (usersExemptFromMaximum.includes(userInfo.giver.id)) {
    return true;
  }
  const emojiInMessage = (messageText.match(recognizeEmojiRegex) || []).length;
  const recognitionGivenToday = await balance.dailyGratitudeRemaining(
    userInfo.giver.id,
    userInfo.giver.tz
  );
  const recognitionInMessage = userInfo.receivers.length * emojiInMessage;
  return recognitionGivenToday + recognitionInMessage <= maximum;
}

// TODO Can we add a 'count' field to the recognition?
async function sendRecognition(recognitionInfo, userInfo) {
  const tags = (recognitionInfo.text.match(tagRegex) || []).map((tag) =>
    tag.slice(1)
  );
  const emojiCount = (recognitionInfo.text.match(recognizeEmojiRegex) || [])
    .length;
  let results = [];
  for (let i = 0; i < userInfo.receivers.length; i++) {
    for (let j = 0; j < emojiCount; j++) {
      results.push(
        recognition.giveRecognition(
          userInfo.giver.id,
          userInfo.receivers[i].id,
          recognitionInfo.text,
          recognitionInfo.channel,
          tags
        )
      );
    }
  }
  return Promise.all(results);
}

async function sendNotificationToReceivers(bot, recognitionInfo, userInfo) {
  let results = [];
  for (let i = 0; i < userInfo.receivers.length; i++) {
    const numberRecieved = await recognition.countRecognitionsReceived(
      userInfo.receivers[i].id
    );
    results.push(
      bot.say({
        text: `You just got recognized by <@${userInfo.giver.id}> in <#${recognitionInfo.channel}> and your new balance is \`${numberRecieved}\`\n>>>${recognitionInfo.text}`,
        channel: userInfo.receivers[i].id,
      })
    );
  }
  return Promise.all(results);
}
