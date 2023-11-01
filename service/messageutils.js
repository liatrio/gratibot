const winston = require("../winston");
const config = require("../config");
const balance = require("./balance");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const { recognizeEmoji, goldenRecognizeEmoji, botName } = config;

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

async function handleGoldenGratitudeErrors(gratitude) {
  return [
    !(await doesUserHoldGoldenRecognition(gratitude.giver.id, "recognizee"))
      ? "- Only the current holder of the golden fistbump can give the golden fistbump"
      : "",

    gratitude.receivers.length > 1
      ? "- You can't give the golden fistbump to multiple users"
      : "",
  ].filter((x) => x !== "");
}

function handleAllErrors(client, message, e) {
  if (e instanceof SlackError) {
    return handleSlackError(client, message, e);
  } else if (e instanceof GratitudeError) {
    return handleGratitudeError(client, message, e);
  } else if (e instanceof GoldenGratitudeError) {
    return handleGoldenGratitudeErrors(client, message, e);
  } else {
    return handleGenericError(client, message, e);
  }
}

async function receiverSlackNotification(gratitude, receiver) {
  const lifetimeTotal = await balance.lifetimeEarnings(receiver);
  const receiverBalance = await balance.currentBalance(receiver);
  let blocks = [];

  const receiverNotificationText = await composeReceiverNotificationText(
    gratitude,
    receiver,
    receiverBalance
  );
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: receiverNotificationText,
    },
  });

  if (gratitude.count == lifetimeTotal) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `I noticed this is your first time receiving a ${recognizeEmoji}. Use \`<@${botName}> redeem\` to see what you can redeem ${recognizeEmoji} for, or try running \`<@${botName}> help\` for more information about me.`,
      },
    });
  }
  return { blocks };
}

async function composeReceiverNotificationText(
  gratitude,
  receiver,
  receiverBalance
) {
  if (gratitude.type === goldenRecognizeEmoji) {
    return `Congratulations, You just got the ${gratitude.type} from <@${gratitude.giver.id}> in <#${gratitude.channel}>, and are now the holder of the Golden Fistbump! You earned \`${gratitude.count}\` and your new balance is \`${receiverBalance}\`. While you hold the Golden Fistbump you will receive a 2X multiplier on all fistbumps received!\n>>>${gratitude.message}`;
  }

  const goldenRecognitionReceiver = await doesUserHoldGoldenRecognition(
    receiver,
    "recognizee"
  );

  if (goldenRecognitionReceiver) {
    return `You just got a ${gratitude.type} from <@${
      gratitude.giver.id
    }> in <#${
      gratitude.channel
    }>. With ${goldenRecognizeEmoji}${goldenRecognizeEmoji}${goldenRecognizeEmoji}${goldenRecognizeEmoji} multiplier you earned \`${
      gratitude.count * 2
    }\` and your new balance is \`${receiverBalance}\`\n>>>${
      gratitude.message
    }`;
  }

  return `You just got a ${gratitude.type} from <@${gratitude.giver.id}> in <#${gratitude.channel}>. You earned \`${gratitude.count}\` and your new balance is \`${receiverBalance}\`\n>>>${gratitude.message}`;
}

async function sendNotificationToReceivers(client, gratitude) {
  for (let i = 0; i < gratitude.receivers.length; i++) {
    await client.chat.postMessage({
      channel: gratitude.receivers[i].id,
      text: getRecieverMessage(gratitude),
      ...(await receiverSlackNotification(
        gratitude,
        gratitude.receivers[i].id
      )),
    });
  }
}

function getRecieverMessage(gratitude) {
  if (gratitude.type === goldenRecognizeEmoji) {
    return `You earned a ${goldenRecognizeEmoji}!!!`;
  }
  return `You earned a ${recognizeEmoji}.`;
}

async function doesUserHoldGoldenRecognition(userId, rec) {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } }
  );

  if (!goldenRecognition) {
    return false;
  }
  if (goldenRecognition[rec] === userId) {
    return true;
  }

  return false;
}

function winstonInfo(info, func, message) {
  winston.info(info, {
    func: func,
    callingUser: message.user,
    slackMessage: message.text,
  });
}

module.exports = {
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
  handleGoldenGratitudeErrors,
  sendNotificationToReceivers,
  getRecieverMessage,
  receiverSlackNotification,
  composeReceiverNotificationText,
  doesUserHoldGoldenRecognition,
  handleAllErrors,
  winstonInfo,
};
