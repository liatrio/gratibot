const winston = require("../winston");
const config = require("../config");
const recognition = require("./recognition");
const { recognizeEmoji, goldenRecognizeEmoji } = config;

async function respondToUser(client, messageContext, options) {
  if (messageContext.channel_type === "im") {
    return client.chat.postMessage({
      channel: messageContext.channel,
      ...options,
    });
  }
  return client.chat.postEphemeral({
    channel: messageContext.channel,
    user: messageContext.user,
    ...options,
  });
}

async function handleSlackError(client, message, error) {
  winston.error("Slack API returned an error response", {
    apiMethod: error.apiMethod,
    apiError: error.apiError,
  });
  return respondToUser(client, message, { text: error.userMessage });
}

async function handleGratitudeError(client, message, error) {
  winston.info("Rejected gratitude request as invalid", {
    gratitudeErrors: error.gratitudeErrors,
  });
  const errorString = error.gratitudeErrors.join("\n");
  return respondToUser(client, message, {
    text: `Sending gratitude failed with the following error(s):\n${errorString}`,
  });
}

async function handleGenericError(client, message, error) {
  winston.error("Slack API returned an error response", {
    error,
  });
  const userMessage = `An unknown error occurred in Gratibot: ${error.message}`;
  return respondToUser(client, message, { text: userMessage });
}

async function sendNotificationToReceivers(client, gratitude) {
  for (let i = 0; i < gratitude.receivers.length; i++) {
    await client.chat.postMessage({
      channel: gratitude.receivers[i].id,
      text: getReceiverMessage(gratitude),
      ...(await recognition.receiverSlackNotification(
        gratitude,
        gratitude.receivers[i].id,
      )),
    });
  }
}

function getReceiverMessage(gratitude) {
  if (gratitude.type === goldenRecognizeEmoji) {
    return `You earned a ${goldenRecognizeEmoji}!!!`;
  }
  return `You earned a ${recognizeEmoji}.`;
}

module.exports = {
  respondToUser,
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
  sendNotificationToReceivers,
  getReceiverMessage,
};
