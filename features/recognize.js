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
const { check } = require("prettier");

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

  // BENGAL TESTING
  // console.log("MESSAGE: ", message);
  // console.log("_______________________________________________________");

  let getIDS = {};
  let allUsers = [];
  let gratitude;
  try {
    // Get all users mentioned in the message (including users in groups)
    getIDS = recognition.gratitudeReceiverIdsIn(message.text);
    allUsers = getIDS.users;
    if (getIDS.groups.length > 0) {
      for (let i = 0; i < getIDS.groups.length; i++) {
        allUsers = allUsers.concat(await groupUsers(client, getIDS.groups[i]).then((users) => {
          return users;
        }));
      }
    }
    gratitude = {
      giver: await userInfo(client, message.user),
      receivers: await Promise.all(allUsers.map(async (id) => userInfo(client, id))),
      count: recognition.gratitudeCountIn(message.text),
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: recognition.gratitudeTagsIn(message.text),
      type: recognizeEmoji,
      giver_in_receivers: false,
    };

    // Check if the user who reacted is also a receiver
    if (gratitude.receivers.some((receiver) => receiver.id === gratitude.giver.id)) {
      gratitude.giver_in_receivers = true;
    }

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

  // BENGAL TESTING
  // console.log("EVENT: ", event);

  event.channel = event.item.channel;

  let getIDS = {};
  let allUsers = [];
  let gratitude;
  let originalMessage;
  try {
    originalMessage = await messageReactedTo(client, event);

    if (!originalMessage.text.includes(recognizeEmoji)) {
      return;
    }

    getIDS = recognition.gratitudeReceiverIdsIn(originalMessage.text);
    allUsers = getIDS.users;
    if (getIDS.groups.length > 0) {
      for (let i = 0; i < getIDS.groups.length; i++) {
        allUsers = allUsers.concat(await groupUsers(client, getIDS.groups[i]).then((users) => {
          return users;
        }));
      }
    }

    // console.log("ALL USERS: ", allUsers);

    gratitude = {
      giver: await userInfo(client, event.user),
      receivers: await Promise.all(allUsers.map(async (id) => userInfo(client, id))),
      count: 1,
      message: originalMessage.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(originalMessage.text),
      channel: event.channel,
      tags: recognition.gratitudeTagsIn(originalMessage.text),
      type: reactionEmoji,
      giver_in_receivers: false,
    };

    // Check if the user who reacted is also a receiver
    if (gratitude.receivers.some((receiver) => receiver.id === gratitude.giver.id)) {
      gratitude.giver_in_receivers = true;
    }

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

// Get the users in a usergroup
async function groupUsers(client, groupId) {
  const response = await client.usergroups.users.list({ usergroup: groupId });
  
  if (response.ok) {
    return response.users;
  }

  throw new SlackError(
    "usergroups.users.list",
    response.error,
    `Something went wrong while sending recognition. When retreiving usergroup information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`
  );
}