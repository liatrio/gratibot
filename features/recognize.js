const {
  recognizeEmoji,
  maximum,
  minimumMessageLength,
  usersExemptFromMaximum,
  reactionEmoji,
} = require("../config");
const recognition = require("../service/recognition");
const balance = require("../service/balance");
// const winston = require("../winston");

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const recognizeEmojiRegex = new RegExp(recognizeEmoji, "g");

module.exports = function (controller) {
  controller.hears(
    recognizeEmoji,
    ["direct_message", "direct_mention", "mention", "message"],
    async (bot, message) => {
      const userInfo = await userDetails(bot, message, message.user);
      if (!userInfo) {
        // TODO Error handling
        return;
      }

      const errors = await checkForRecognitionErrors(message, userInfo);
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

      await sendRecognition(message, userInfo);
      const gratitudeRemaining = await balance.dailyGratitudeRemaining(
        userInfo.giver.id,
        userInfo.giver.tz
      );

      await Promise.all([
        sendNotificationToReceivers(bot, message, userInfo),
        bot.replyEphemeral(
          message,
          `Your ${recognizeEmoji} has been sent. You have ${gratitudeRemaining} left to give today.`
        ),
      ]);
    }
  );

  controller.on("reaction_added", testFunction);
};

async function testFunction(bot, message) {
  if (
    !message.reaction.includes(reactionEmoji) ||
    message.item.type !== "message"
  ) {
    return;
  }

  let originalMessage = await bot.api.conversations.history({
    channel: message.item.channel,
    latest: message.item.ts,
    limit: 1,
    inclusive: true,
  });
  originalMessage = originalMessage.messages[0];
  originalMessage.channel = message.channel;

  const userInfo = await userDetails(bot, originalMessage, message.user);
  if (!userInfo) {
    // TODO Error handling
    return;
  }

  const errors = await checkForRecognitionErrors(originalMessage, userInfo);
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

  await sendRecognition(originalMessage, userInfo);
  const gratitudeRemaining = await balance.dailyGratitudeRemaining(
    userInfo.giver.id,
    userInfo.giver.tz
  );

  await Promise.all([
    sendNotificationToReceivers(bot, originalMessage, userInfo),
    bot.replyEphemeral(
      message,
      `Your ${recognizeEmoji} has been sent. You have ${gratitudeRemaining} left to give today.`
    ),
  ]);
}

async function userDetails(bot, message, giver) {
  const userStrings = message.text.match(userRegex) || [];
  const userIds = userStrings.map((user) => user.slice(2, -1));
  const userInfo = {
    giver: await bot.api.users.info({ user: giver }),
    receivers: await Promise.all(
      userIds.map(async (user) => bot.api.users.info({ user: user }))
    ),
  };

  return parseUserDetailsRequest(userInfo);
}

// TODO clean this up. Maybe check for errors after each API call?
function parseUserDetailsRequest(userInfo) {
  let infoRequestIsOk = true;
  /*
  if (!userInfo.giver.ok) {
    winston.error("User info request failed", {
      user: message.user,
      error: userInfo.giver.error,
    });
    infoRequestIsOk = false;
  }
  */
  userInfo.giver = userInfo.giver.user;
  for (let i = 0; i < userInfo.receivers.length; i++) {
    /*
    if (!userInfo.receivers[i].ok) {
      winston.error("User info request failed", {
        user: userIds[i],
        error: userInfo.receivers[i].error,
      });
      infoRequestIsOk = false;
    }
    */
    userInfo.receivers[i] = userInfo.receivers[i].user;
  }
  return infoRequestIsOk ? userInfo : null;
}

async function checkForRecognitionErrors(message, userInfo) {
  const trimmedMessage = message.text
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
    !(await isRecognitionWithinSpendingLimits(message, userInfo))
      ? `- A maximum of ${maximum} ${recognizeEmoji} can be sent per day`
      : "",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

async function isRecognitionWithinSpendingLimits(message, userInfo) {
  if (usersExemptFromMaximum.includes(userInfo.giver.id)) {
    return true;
  }
  const emojiInMessage = (message.text.match(recognizeEmojiRegex) || []).length;
  const recognitionGivenToday = await balance.dailyGratitudeRemaining(
    userInfo.giver.id,
    userInfo.giver.tz
  );
  const recognitionInMessage = userInfo.receivers.length * emojiInMessage;
  return recognitionGivenToday + recognitionInMessage <= maximum;
}

async function sendRecognition(message, userInfo) {
  const tags = (message.text.match(tagRegex) || []).map((tag) => tag.slice(1));
  const emojiCount = (message.text.match(recognizeEmojiRegex) || []).length;
  let results = [];
  for (let i = 0; i < userInfo.receivers.length; i++) {
    for (let j = 0; j < emojiCount; j++) {
      results.push(
        recognition.giveRecognition(
          userInfo.giver.id,
          userInfo.receivers[i].id,
          message.text,
          message.channel,
          tags
        )
      );
    }
  }
  return Promise.all(results);
}

async function sendNotificationToReceivers(bot, message, userInfo) {
  let results = [];
  for (let i = 0; i < userInfo.receivers.length; i++) {
    const numberRecieved = await recognition.countRecognitionsReceived(
      userInfo.receivers[i].id
    );
    results.push(
      bot.say({
        text: `You just got recognized by <@${userInfo.giver.id}> in <#${message.channel}> and your new balance is \`${numberRecieved}\`\n>>>${message.text}`,
        channel: userInfo.receivers[i].id,
      })
    );
  }
  return Promise.all(results);
}
