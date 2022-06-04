const config = require("../config");
const recognition = require("../service/recognition");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const { reactionMatches } = require("../middleware");
const { userInfo } = require("../service/apiwrappers");
const {
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
  sendNotificationToReceivers,
} = require("../service/messageutils");

const { recognizeEmoji, reactionEmoji } = config;

module.exports = function (app) {
  app.message(recognizeEmoji, respondToRecognitionMessage);
  app.event(
    "reaction_added",
    reactionMatches(reactionEmoji),
    respondToRecognitionReaction
  );
};

async function respondToRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${recognizeEmoji}`, {
    func: "features.recognize.respondToRecognitionMessage",
    callingUser: message.user,
    slackMessage: message.text,
  });
  let gratitude;
  try {
    gratitude = {
      giver: await userInfo(client, message.user),
      receivers: await Promise.all(
        recognition
          .gratitudeReceiverIdsIn(message.text)
          .map(async (receiver) => userInfo(client, receiver))
      ),
      count: recognition.gratitudeCountIn(message.text),
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: recognition.gratitudeTagsIn(message.text),
      type: recognizeEmoji,
    };

    await recognition.validateAndSendGratitude(gratitude);

    winston.debug(
      `validated and stored message recognitions from ${gratitude.giver}`,
      {
        func: "features.recognize.respondToRecognitionMessage",
        callingUser: message.user,
        slackMessage: message.text,
      }
    );
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(client, message, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(client, message, e);
    } else {
      return handleGenericError(client, message, e);
    }
  }

  return Promise.all([
    sendNotificationToReceivers(client, gratitude),
    client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `${recognizeEmoji} has been sent.`,
      ...(await recognition.giverSlackNotification(gratitude)),
    }),
    client.reactions.add({
      channel: message.channel,
      name: config.reactionEmoji.slice(1, -1),
      timestamp: message.ts,
    }),
  ]);
}

async function respondToRecognitionReaction({ event, client }) {
  winston.info(`Saw a reaction containing ${reactionEmoji}`, {
    func: "features.recognize.respondToRecognitionReaction",
    callingUser: event.user,
    reactionEmoji: event.reaction,
  });
  event.channel = event.item.channel;
  let originalMessage;
  let gratitude;
  try {
    originalMessage = await messageReactedTo(client, event);

    if (!originalMessage.text.includes(recognizeEmoji)) {
      return;
    }

    gratitude = {
      giver: await userInfo(client, event.user),
      receivers: await Promise.all(
        recognition
          .gratitudeReceiverIdsIn(originalMessage.text)
          .map(async (receiver) => userInfo(client, receiver))
      ),
      count: 1,
      message: originalMessage.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(originalMessage.text),
      channel: event.channel,
      tags: recognition.gratitudeTagsIn(originalMessage.text),
      type: reactionEmoji,
    };
    await recognition.validateAndSendGratitude(gratitude);
    winston.debug(
      `validated and stored reaction recognitions from ${gratitude.giver}`,
      {
        func: "features.recognize.respondToRecognitionReaction",
        callingUser: event.user,
        slackMessage: event.reactions,
      }
    );
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(client, event, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(client, event, e);
    } else {
      return handleGenericError(client, event, e);
    }
  }

  return Promise.all([
    sendNotificationToReceivers(client, gratitude),
    client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: `${recognizeEmoji} has been sent.`,
      ...(await recognition.giverSlackNotification(gratitude)),
    }),
  ]);
}

async function messageReactedTo(client, message) {
  const response = await client.conversations.replies({
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
