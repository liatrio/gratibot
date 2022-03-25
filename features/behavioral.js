const config = require("../config");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const recognition = require("../service/recognition");
const { userInfo } = require("../service/apiwrappers");
const {
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
} = require("../service/messageutils");

const { recognizeEmoji } = config;

module.exports = function (app) {
  app.message(respondToMessage);
};

// engineering channel id is CAU2RUS8Y

async function respondToMessage({ message, client }) {
    // filter on engineering
    if (message.channel ===  "C038KVBE9BM") {
      winston.info(`Event payload:\n ${message}`);
      let gratitude;
      try {
        gratitude = {
          // remove hardcoded bot id
          giver: await userInfo(client, "U031JBA3XDW"),
          receivers: await userInfo(client, message.user),
          count: 1,
          message: message.text,
          trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
          channel: message.channel,
          tags: recognition.gratitudeTagsIn(message.text),
          type: recognizeEmoji,
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
      // give recognition to poster
    }
}
