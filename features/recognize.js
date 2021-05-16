const config = require("../config");
const recognition = require("../service/recognition");
const balance = require("../service/balance");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");

const { recognizeEmoji, reactionEmoji } = config;

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
  let gratitude;
  try {
    gratitude = {
      giver: await userInfo(bot, message.user),
      receivers: await Promise.all(
        recognition
          .gratitudeReceiverIdsIn(message.text)
          .map(async (receiver) => userInfo(bot, receiver))
      ),
      count: recognition.gratitudeCountIn(message.text),
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: recognition.gratitudeTagsIn(message.text),
    };

    await recognition.validateAndSendGratitude(gratitude);
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(bot, message, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(bot, message, e);
    } else {
      return handleGenericError(bot, message, e);
    }
  }
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

  let originalMessage;
  let gratitude;
  try {
    originalMessage = await messageReactedTo(bot, message);

    if (!originalMessage.text.includes(recognizeEmoji)) {
      return;
    }

    gratitude = {
      giver: await userInfo(bot, message.user),
      receivers: await Promise.all(
        recognition
          .gratitudeReceiverIdsIn(originalMessage.text)
          .map(async (receiver) => userInfo(bot, receiver))
      ),
      count: recognition.gratitudeCountIn(originalMessage.text),
      message: originalMessage.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(originalMessage.text),
      channel: originalMessage.channel,
      tags: recognition.gratitudeTagsIn(originalMessage.text),
    };
    await recognition.validateAndSendGratitude(gratitude);
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(bot, message, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(bot, message, e);
    } else {
      return handleGenericError(bot, message, e);
    }
  }

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

// API Wrappers

async function userInfo(bot, userId) {
  const response = await bot.api.users.info({ user: userId });
  if (response.ok) {
    return response.user;
  }
  throw new SlackError(
    "users.info",
    response.error,
    `Something went wrong while sending recognition. When retreiving user information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`
  );
}

async function messageReactedTo(bot, message) {
  const response = await bot.api.conversations.replies({
    channel: message.item.channel,
    ts: message.item.ts,
    limit: 1,
  });
  if (response.ok) {
    return response.messages[0];
  }
  throw new SlackError(
    "conversations.replies",
    response.error,
    `Something went wrong while sending recognition. When retreiving message information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`
  );
}

// Response Message Utils

async function handleSlackError(bot, message, error) {
  winston.error("Slack API returned an error response", {
    apiMethod: error.apiMethod,
    apiError: error.apiError,
  });
  return bot.replyEphemeral(message, error.userMessage);
}

async function handleGratitudeError(bot, message, error) {
  winston.info("Rejected gratitude request as invalid", {
    gratitudeErrors: error.gratitudeErrors,
  });
  const errorString = error.gratitudeErrors.join("\n");
  return bot.replyEphemeral(
    message,
    `Sending gratitude failed with the following error(s):\n${errorString}`
  );
}

async function handleGenericError(bot, message, error) {
  winston.error("Slack API returned an error response", {
    error,
  });
  const userMessage = `An unknown error occured in Gratibot: ${error.message}`;
  return bot.replyEphemeral(message, userMessage);
}

async function sendNotificationToReceivers(bot, message, gratitude) {
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
