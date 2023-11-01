const config = require("../config");
const moment = require("moment-timezone");
const recognitionCollection = require("../database/recognitionCollection");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const balance = require("./balance");
const { SlackError, GratitudeError } = require("./errors");
const winston = require("../winston");
const { userInfo } = require("./apiwrappers");
const {
  handleAllErrors,
  sendNotificationToReceivers,
  doesUserHoldGoldenRecognition,
  handleGoldenGratitudeErrors,
} = require("./messageutils");

const {
  recognizeEmoji,
  reactionEmoji,
  goldenRecognizeEmoji,
  maximum,
  minimumMessageLength,
} = config;

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const groupRegex = /<!subteam\^([a-zA-Z0-9]+)\|@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const gratitudeEmojiRegex = new RegExp(config.recognizeEmoji, "g");
const multiplierRegex = new RegExp(
  `${config.recognizeEmoji}\\s*x([0-9]+)|x([0-9]+)\\s${config.recognizeEmoji}`
);

// TODO Can we add a 'count' field to the recognition?
async function giveRecognition(
  recognizer,
  recognizee,
  message,
  channel,
  values,
  type = recognizeEmoji
) {
  let timestamp = new Date();

  winston.debug(`${recognizer} is giving recognition to ${recognizee}`, {
    func: "service.recognition.giveRecognition",
  });

  const collectionValues = {
    recognizer: recognizer,
    recognizee: recognizee,
    timestamp: timestamp,
    message: message,
    channel: channel,
    values: values,
  };
  if (type === goldenRecognizeEmoji) {
    return await goldenRecognitionCollection.insert(collectionValues);
  }
  return await recognitionCollection.insert(collectionValues);
}

async function countRecognitionsReceived(user, timezone = null, days = null) {
  let filter = { recognizee: user };
  if (days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf("day");
    midnight = midnight.subtract(days - 1, "days");
    filter.timestamp = {
      $gte: new Date(midnight),
    };
  }

  winston.debug(`retrieving recognitions received for ${user}`, {
    func: "service.recognition.countRecognitionsReceived",
    callingUser: user,
    timezone: timezone,
    days: days,
    filter: filter,
  });

  return await recognitionCollection.count(filter);
}

async function countRecognitionsGiven(user, timezone = null, days = null) {
  let filter = { recognizer: user };
  if (days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf("day");
    midnight = midnight.subtract(days - 1, "days");
    filter.timestamp = {
      $gte: new Date(midnight),
    };
  }

  winston.debug(`retrieving recognitions given ${user}`, {
    func: "service.recognition.countRecognitionsGiven",
    callingUser: user,
    timezone: timezone,
    days: days,
    filter: filter,
  });

  return await recognitionCollection.count(filter);
}

async function getPreviousXDaysOfRecognition(timezone = null, days = null) {
  //get only the entries from the specifc day from midnight
  let filter = {};
  if (days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf("day");
    midnight = midnight.subtract(days - 1, "days");
    filter.timestamp = {
      $gte: new Date(midnight),
    };
  }

  winston.debug("retrieving total recognitions given", {
    func: "service.recognition.getPreviousXDaysOfRecognition",
    timezone: timezone,
    days: days,
    filter: filter,
  });

  return await recognitionCollection.find(filter);
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

async function gratitudeReceiverIdsIn(client, text) {
  let users = (text.match(userRegex) || []).map((userMention) =>
    userMention.slice(2, -1)
  );
  let groups = (text.match(groupRegex) || []).map((groupMention) =>
    groupMention.substring(
      groupMention.indexOf("^") + 1,
      groupMention.lastIndexOf("|")
    )
  );
  for (let i = 0; i < groups.length; i++) {
    users = users.concat(await groupUsers(client, groups[i]));
  }
  return users;
}

function gratitudeCountIn(text) {
  const emojiCount = (text.match(gratitudeEmojiRegex) || []).length;
  const multiplierFinding = text.match(multiplierRegex)
    ? text.match(multiplierRegex).filter(Boolean)
    : null;
  const multiplier = multiplierFinding ? multiplierFinding[1] : 1;
  return emojiCount * multiplier;
}

function gratitudeTagsIn(text) {
  return (text.match(tagRegex) || []).map((tag) => tag.slice(1));
}

function trimmedGratitudeMessage(text) {
  return text
    .replace(userRegex, "")
    .replace(groupRegex, "")
    .replace(generalEmojiRegex, "");
}

async function isGratitudeAffordable(gratitude) {
  if (gratitude.type === goldenRecognizeEmoji) {
    return true;
  }
  const dailyGratitudeRemaining = await balance.dailyGratitudeRemaining(
    gratitude.giver.id,
    gratitude.giver.tz
  );
  if (gratitude.giver_in_receivers) {
    gratitude.receivers = gratitude.receivers.filter(
      (x) => x.id !== gratitude.giver.id
    );
  }
  const gratitudeCost = gratitude.receivers.length * gratitude.count;
  return dailyGratitudeRemaining >= gratitudeCost;
}

async function gratitudeErrors(gratitude) {
  return [
    gratitude.receivers.length === 0
      ? "- Mention who you want to recognize with @user"
      : "",

    gratitude.receivers.find((x) => x.id == gratitude.giver.id) &&
    gratitude.receivers.length === 1
      ? "- You can't recognize yourself"
      : "",

    gratitude.giver.is_bot ? "- Bots can't give recognition" : "",
    gratitude.giver.is_restricted ? "- Guest users can't give recognition" : "",
    gratitude.receivers.find((x) => x.is_bot)
      ? "- You can't give recognition to bots"
      : "",
    gratitude.receivers.find((x) => x.is_restricted)
      ? "- You can't give recognition to guest users"
      : "",
    gratitude.trimmedMessage.length < minimumMessageLength
      ? `- Your message must be at least ${minimumMessageLength} characters`
      : "",
    gratitude.count < 1
      ? `- You can't send less than one ${recognizeEmoji}`
      : "",
    !(await isGratitudeAffordable(gratitude))
      ? `- A maximum of ${maximum} ${recognizeEmoji} can be sent per day`
      : "",
  ].filter((x) => x !== "");
}

async function giveGratitude(gratitude) {
  let results = [];

  if (gratitude.giver_in_receivers) {
    gratitude.receivers = gratitude.receivers.filter(
      (x) => x.id !== gratitude.giver.id
    );
  }

  for (let i = 0; i < gratitude.receivers.length; i++) {
    if (gratitude.type === goldenRecognizeEmoji) {
      results.push(
        giveRecognition(
          gratitude.giver.id,
          gratitude.receivers[i].id,
          gratitude.trimmedMessage,
          gratitude.channel,
          gratitude.tags,
          gratitude.type
        )
      );
    } else {
      let extraRecognitions = 0;
      if (
        await doesUserHoldGoldenRecognition(
          gratitude.receivers[i].id,
          "recognizee"
        )
      ) {
        extraRecognitions = gratitude.count;
      }

      for (let j = 0; j < gratitude.count; j++) {
        results.push(
          giveRecognition(
            gratitude.giver.id,
            gratitude.receivers[i].id,
            gratitude.trimmedMessage,
            gratitude.channel,
            gratitude.tags
          )
        );
      }

      for (let j = 0; j < extraRecognitions; j++) {
        results.push(
          giveRecognition(
            "goldenFistbumpMultiplier",
            gratitude.receivers[i].id,
            gratitude.trimmedMessage,
            gratitude.channel,
            gratitude.tags
          )
        );
      }
    }
  }
  return Promise.all(results);
}

async function validateAndSendGratitude(gratitude) {
  const errors = await gratitudeErrors(gratitude);
  let goldenRecognizeErrors = [];
  if (gratitude.type === goldenRecognizeEmoji) {
    goldenRecognizeErrors = await handleGoldenGratitudeErrors(gratitude);
  }

  const combinedErrors = [...errors, ...goldenRecognizeErrors];

  if (combinedErrors.length > 0) {
    throw new GratitudeError(combinedErrors);
  }

  return giveGratitude(gratitude);
}

// Slack Messages

async function giverSlackNotification(gratitude) {
  const gratitudeRemaining = await balance.dailyGratitudeRemaining(
    gratitude.giver.id,
    gratitude.giver.tz
  );
  const totalGratitudeValue = gratitude.count * gratitude.receivers.length;
  let blocks = [];
  const recognitionType = gratitude.type;

  // Notify the user if they are giving recognition to themselves when in the receiver list.
  let excludingGiver = "";
  if (gratitude.giver_in_receivers) {
    excludingGiver = ", excluding yourself";
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        totalGratitudeValue > 1
          ? `Your \`${totalGratitudeValue}\` ${recognitionType} have been sent${excludingGiver}. You have \`${gratitudeRemaining}\` left to give today.`
          : `Your \`${totalGratitudeValue}\` ${recognitionType} has been sent${excludingGiver}. You have \`${gratitudeRemaining}\` left to give today.`,
    },
  });
  return { blocks };
}

async function respondToRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${recognizeEmoji}`, {
    func: "service.recognition.respondToRecognitionMessage",
    callingUser: message.user,
    slackMessage: message.text,
  });
  try {
    const gratitude = await buildGratitudeObject({ message, client });
    await validateAndSendGratitude(gratitude);
    winston.debug(
      `validated and stored message recognitions from ${gratitude.giver}`,
      {
        func: "service.recognition.respondToRecognitionMessage",
        callingUser: message.user,
        slackMessage: message.text,
      }
    );

    return Promise.all([
      sendNotificationToReceivers(client, gratitude),
      sendUserNotification(client, message, gratitude),
      addReaction(client, message),
    ]);
  } catch (e) {
    return handleAllErrors(client, message, e);
  }
}

async function respondToRecognitionReaction({ event, client }) {
  winston.info(`Saw a reaction containing ${reactionEmoji}`, {
    func: "service.recognition.respondToRecognitionReaction",
    callingUser: event.user,
    reactionEmoji: event.reaction,
  });
  try {
    event.channel = event.item.channel;
    const { gratitude, originalMessage } = await buildGratitudeFromReaction({
      event,
      client,
    });

    if (!originalMessage.text.includes(recognizeEmoji)) {
      return;
    }

    await validateAndSendGratitude(gratitude);
    winston.debug(
      `validated and stored reaction recognitions from ${gratitude.giver}`,
      {
        func: "service.recognition.respondToRecognitionReaction",
        callingUser: event.user,
        slackMessage: event.reactions,
      }
    );

    return Promise.all([
      sendNotificationToReceivers(client, gratitude),
      sendUserNotification(client, event, gratitude),
    ]);
  } catch (e) {
    return handleAllErrors(client, event, e);
  }
}

async function buildGratitudeObject({ message, client }) {
  const allUsers = await gratitudeReceiverIdsIn(client, message.text);
  const giver = await userInfo(client, message.user);
  const receivers = await Promise.all(
    allUsers.map((id) => userInfo(client, id))
  );
  const count = gratitudeCountIn(message.text);
  const trimmedMessage = trimmedGratitudeMessage(message.text);
  const tags = gratitudeTagsIn(message.text);
  const type = recognizeEmoji;
  const giver_in_receivers = receivers.some((r) => r.id === giver.id);

  return {
    giver,
    receivers,
    count,
    message: message.text,
    trimmedMessage,
    channel: message.channel,
    tags,
    type,
    giver_in_receivers,
  };
}

async function buildGratitudeFromReaction({ event, client }) {
  const originalMessage = await messageReactedTo(client, event);
  const allUsers = await gratitudeReceiverIdsIn(client, originalMessage.text);
  const giver = await userInfo(client, event.user);
  const receivers = await Promise.all(
    allUsers.map((id) => userInfo(client, id))
  );
  const count = 1;
  const trimmedMessage = trimmedGratitudeMessage(originalMessage.text);
  const tags = gratitudeTagsIn(originalMessage.text);
  const giver_in_receivers = receivers.some((r) => r.id === giver.id);

  const gratitude = {
    giver,
    receivers,
    count,
    message: originalMessage.text,
    trimmedMessage,
    channel: event.channel,
    tags,
    type: recognizeEmoji,
    giver_in_receivers,
  };

  return { gratitude, originalMessage };
}

async function sendUserNotification(client, message, gratitude) {
  return client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: `${recognizeEmoji} has been sent.`,
    ...(await giverSlackNotification(gratitude)),
  });
}

async function addReaction(client, message) {
  return client.reactions.add({
    channel: message.channel,
    name: config.reactionEmoji.slice(1, -1),
    timestamp: message.ts,
  });
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

/*
 * Gratitude Object
 *
 * {
 *   giver: {
 *     id: string,
 *     tz: string,
 *     is_bot: bool,
 *     is_restricted: bool,
 *   },
 *   receivers: [{
 *     id: string,
 *     is_bot: bool,
 *     is_restricted: bool,
 *   }]
 *   count: number,
 *   message: string,
 *   trimmedMessage: string,
 *   channel: string,
 *   tags: [string],
 *   type: string,
 * }
 */

module.exports = {
  giveRecognition,
  countRecognitionsReceived,
  countRecognitionsGiven,
  getPreviousXDaysOfRecognition,
  gratitudeReceiverIdsIn,
  gratitudeCountIn,
  isGratitudeAffordable,
  gratitudeErrors,
  trimmedGratitudeMessage,
  gratitudeTagsIn,
  giveGratitude,
  validateAndSendGratitude,
  giverSlackNotification,
  groupUsers,
  respondToRecognitionMessage,
  respondToRecognitionReaction,
  messageReactedTo,
  buildGratitudeObject,
  buildGratitudeFromReaction,
  sendUserNotification,
  addReaction,
};
