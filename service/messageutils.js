const winston = require("../winston");
const config = require("../config");
const recognition = require("./recognition");
const { recognizeEmoji, goldenRecognizeEmoji } = config;

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
  const userMessage = `An unknown error occured inGratibot: ${error.message}`;
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
      text: getRecieverMessage(gratitude),
      ...(await recognition.receiverSlackNotification(
        gratitude,
        gratitude.receivers[i].id
      )),
    });
  }
}

function getRecieverMessage(gratitude) {
  if (gratitude.type === ":booom:") {
    return `You earned a ${goldenRecognizeEmoji}!!!`;
  }
  return `You earned a ${recognizeEmoji}.`;
}

module.exports = {
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
  sendNotificationToReceivers,
};
