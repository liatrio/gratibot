const winston = require("../winston");
const config = require("../config");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const { userInfo } = require("./apiwrappers");
const {
  handleAllErrors,
  sendNotificationToReceivers,
} = require("./messageutils");

const {
  gratitudeReceiverIdsIn,
  trimmedGratitudeMessage,
  gratitudeTagsIn,
  validateAndSendGratitude,
} = require("./recognition");

const { goldenRecognizeEmoji } = config;

async function getGoldenFistbumpHolder() {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } }
  );
  if (!goldenRecognition) {
    return {
      goldenFistbumpHolder: "none",
      message: "",
      timestamp: "",
    };
  }
  return {
    goldenFistbumpHolder: goldenRecognition.recognizee,
    message: goldenRecognition.message,
    timestamp: goldenRecognition.timestamp,
  };
}

async function giverGoldenSlackNotification(gratitude) {
  let blocks = [];
  const recognitionType = gratitude.type;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `You have handed off the ${recognitionType}. Thanks for sharing the wealth!`,
    },
  });
  return { blocks };
}

async function respondToGoldenRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${goldenRecognizeEmoji}`, {
    func: "service.recognition.respondToGoldenRecognitionMessage",
    callingUser: message.user,
    slackMessage: message.text,
  });
  let allUsers = [];
  let gratitude;
  try {
    allUsers = await gratitudeReceiverIdsIn(client, message.text);
    gratitude = {
      giver: await userInfo(client, message.user),
      receivers: await Promise.all(
        allUsers.map(async (id) => userInfo(client, id))
      ),
      count: 1,
      message: message.text,
      trimmedMessage: trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: gratitudeTagsIn(message.text),
      type: goldenRecognizeEmoji,
    };

    await validateAndSendGratitude(gratitude);
  } catch (e) {
    return handleAllErrors(client, message, e);
  }

  return Promise.all([
    //send notification to receivers sends a DM from gratibot to the receiver of the fistbump
    sendNotificationToReceivers(client, gratitude),
    //this call to postEphemeral sends a message only the giver can see in the channel where the fistbump was given
    client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `${goldenRecognizeEmoji} has been sent.`,
      ...(await giverGoldenSlackNotification(gratitude)),
    }),
    //this call to postMessage sends a message to a separate public channel for everyone to see
    client.chat.postMessage({
      channel: config.goldenRecognizeChannel,
      text: `The ${goldenRecognizeEmoji} has been bestowed upon thy majesty <@${gratitude.receivers[0].id}> by <@${gratitude.giver.id}> in <#${message.channel}>! :crown:  :tada:\n>${message.text}\n>`,
    }),
  ]);
}

async function goldenFistbumpHolder() {
  let { goldenFistbumpHolder, message, timestamp } =
    await getGoldenFistbumpHolder();
  let receivedDate = new Date(timestamp);
  receivedDate = receivedDate.toLocaleDateString().substring(0, 10);

  let markdown = `*Current Golden Fistbump Holder. Received ${receivedDate}*\n\n`;
  markdown += `<@${goldenFistbumpHolder}> - *${message}*`;

  return {
    type: "section",
    block_id: "goldenFistbumpHolder",
    text: {
      type: "mrkdwn",
      text: markdown,
    },
  };
}

module.exports = {
  getGoldenFistbumpHolder,
  respondToGoldenRecognitionMessage,
  giverGoldenSlackNotification,
  goldenFistbumpHolder,
};
