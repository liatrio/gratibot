const config = require("../config");
const recognition = require("../service/recognition");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const { userInfo } = require("../service/apiwrappers");
const {
  respondToUser,
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
} = require("../service/messageutils");

const { selfRecognizeEmoji } = config;

module.exports = function (app) {
  app.message(selfRecognizeEmoji, respondToSelfRecognitionMessage);
};

async function respondToSelfRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${selfRecognizeEmoji}`, {
    func: "features.self-recognize.respondToSelfRecognitionMessage",
    callingUser: message.user,
    slackMessage: message.text,
  });

  let gratitude;
  try {
    gratitude = {
      giver: await userInfo(client, message.user),
      count: 1,
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      channelType: message.channel_type,
      tags: recognition.gratitudeTagsIn(message.text),
      type: selfRecognizeEmoji,
    };

    await recognition.validateAndSendSelfGratitude(gratitude);

    winston.debug(
      `validated and stored self recognition from ${gratitude.giver.id}`,
      {
        func: "features.self-recognize.respondToSelfRecognitionMessage",
        callingUser: message.user,
        slackMessage: message.text,
      },
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
    respondToUser(client, message, {
      text: `${selfRecognizeEmoji} has been sent.`,
      ...(await recognition.giverSelfSlackNotification(gratitude)),
    }),
    client.reactions.add({
      channel: message.channel,
      name: config.reactionEmoji.slice(1, -1),
      timestamp: message.ts,
    }),
  ]);
}
