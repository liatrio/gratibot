const config = require("../config");
const recognition = require("../service/recognition");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const { userInfo } = require("../service/apiwrappers");
const { handleSlackError, handleGratitudeError, handleGenericError, sendNotificationToReceivers } = require("../service/messageutils");

const { superRecognizeEmoji } = config;

module.exports = function (app) {
  app.message(superRecognizeEmoji, respondToRecognitionMessage);
};

async function respondToRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${superRecognizeEmoji}`, {
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
      count: 25,
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: recognition.gratitudeTagsIn(message.text),
      type: superRecognizeEmoji,
    };

    await recognition.validateAndSendGratitude(gratitude);
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
      text: `${superRecognizeEmoji} has been sent.`,
      ...(await recognition.giverSlackNotification(gratitude)),
    }),
  ]);
}
