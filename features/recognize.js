const config = require("../config");
const recognition = require("../service/recognition");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const { reactionMatches } = require("../middleware");

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

// API Wrappers

async function userInfo(client, userId) {
  const response = await client.users.info({ user: userId });
  if (response.ok) {
    return response.user;
  }
  throw new SlackError(
    "users.info",
    response.error,
    `Something went wrong while sending recognition. When retreiving user information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`
  );
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

// Response Message Utils

async function handleSlackError(client, message, error) {
  winston.error("Slack API returned an error response", {
    apiMethod: error.apiMethod,
    apiError: error.apiError,
  });
  return client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: error.userMessage,
  });
}

async function handleGratitudeError(client, message, error) {
  winston.info("Rejected gratitude request as invalid", {
    gratitudeErrors: error.gratitudeErrors,
  });
  const errorString = error.gratitudeErrors.join("\n");
  return client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: `Sending gratitude failed with the following error(s):\n${errorString}`,
  });
}

async function handleGenericError(client, message, error) {
  winston.error("Slack API returned an error response", {
    error,
  });
  const userMessage = `An unknown error occured in Gratibot: ${error.message}`;
  return client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: userMessage,
  });
}

async function sendNotificationToReceivers(client, gratitude) {
  for (let i = 0; i < gratitude.receivers.length; i++) {
    await client.chat.postMessage({
      channel: gratitude.receivers[i].id,
      text: `You earned a ${recognizeEmoji}.`,
      ...(await recognition.receiverSlackNotification(
        gratitude,
        gratitude.receivers[i].id
      )),
    });
    winston.debug("gratitude notification successfully posted to Slack", {
      func: "features.recognize.sendNotificationToReceivers",
      gratitude_receiver: gratitude.receiver[i].id,
    });
  }
}
