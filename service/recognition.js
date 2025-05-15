const config = require("../config");
const moment = require("moment-timezone");
const recognitionCollection = require("../database/recognitionCollection");
const goldenRecognitionCollection = require("../database/goldenRecognitionCollection");
const balance = require("./balance");
const { SlackError, GratitudeError } = require("./errors");
const winston = require("../winston");
const sentiment = require("./sentiment");

const {
  recognizeEmoji,
  goldenRecognizeEmoji,
  maximum,
  minimumMessageLength,
  botName,
} = config;

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const groupRegex = /<!subteam\^([a-zA-Z0-9]+)(\|@([a-zA-Z0-9\-_]+))?>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const gratitudeEmojiRegex = new RegExp(config.recognizeEmoji, "g");
const multiplierRegex = new RegExp(
  `${config.recognizeEmoji}\\s*[Xx]([0-9]+)|[Xx]([0-9]+)\\s${config.recognizeEmoji}`,
);

// TODO Can we add a 'count' field to the recognition?
async function giveRecognition(
  recognizer,
  recognizee,
  message,
  channel,
  values,
  type = recognizeEmoji,
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

async function getGoldenFistbumpHolder() {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } },
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

async function doesUserHoldGoldenRecognition(userId, rec) {
  const goldenRecognition = await goldenRecognitionCollection.findOne(
    {},
    { sort: { timestamp: -1 } },
  );

  if (!goldenRecognition) {
    return false;
  }
  if (goldenRecognition[rec] === userId) {
    return true;
  }

  return false;
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
    `Something went wrong while sending recognition. When retreiving usergroup information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`,
  );
}

async function gratitudeReceiverIdsIn(client, text) {
  let users = (text.match(userRegex) || []).map((userMention) =>
    userMention.slice(2, -1),
  );
  for (const groupMatch of text.matchAll(groupRegex)) {
    users = users.concat(await groupUsers(client, groupMatch[1]));
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
    gratitude.giver.tz,
  );
  if (gratitude.giver_in_receivers) {
    gratitude.receivers = gratitude.receivers.filter(
      (x) => x.id !== gratitude.giver.id,
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

async function goldenGratitudeErrors(gratitude) {
  return [
    !(await doesUserHoldGoldenRecognition(gratitude.giver.id, "recognizee"))
      ? "- Only the current holder of the golden fistbump can give the golden fistbump"
      : "",

    gratitude.receivers.length > 1
      ? "- You can't give the golden fistbump to multiple users"
      : "",
  ].filter((x) => x !== "");
}

async function giveGratitude(gratitude) {
  const errors = await gratitudeErrors(gratitude);
  if (errors.length > 0) {
    throw new GratitudeError(errors);
  }

  let results = [];

  // Analyze sentiment of the message
  let values = { ...gratitude.values };
  try {
    values.sentiments = await sentiment.analyzeSentiment(gratitude.message);
  } catch (error) {
    winston.error('Failed to analyze sentiment', {
      func: "service.recognition.giveGratitude",
      error: error.message,
    });
    values.sentiments = ['N/A'];
  }

  if (gratitude.giver_in_receivers) {
    winston.info(
      `User ${gratitude.giver.id} attempted to give recognition to themselves`,
      {
        func: "service.recognition.giveGratitude",
      },
    );
  }

  const recognitionPromises = gratitude.receivers
    .filter((receiver) => receiver.id !== gratitude.giver.id)
    .map((receiver) =>
      giveRecognition(
        gratitude.giver.id,
        receiver.id,
        gratitude.message,
        gratitude.channel,
        values,
        gratitude.type,
      ),
    );

  results = results.concat(recognitionPromises);

  if (gratitude.type === goldenRecognizeEmoji) {
    results.push(
      giveRecognition(
        gratitude.giver.id,
        gratitude.receivers[0].id,
        gratitude.message,
        gratitude.channel,
        { ...gratitude.values, sentiments: await sentiment.analyzeSentiment(gratitude.message) },
        gratitude.type,
      ),
    );
  } else {
    let extraRecognitions = 0;
    if (
      await doesUserHoldGoldenRecognition(
        gratitude.receivers[0].id,
        "recognizee",
      )
    ) {
      extraRecognitions = gratitude.count;
    }

    for (let j = 0; j < gratitude.count; j++) {
      results.push(
        giveRecognition(
          gratitude.giver.id,
          gratitude.receivers[0].id,
          gratitude.message,
          gratitude.channel,
          { ...gratitude.values, sentiments: await sentiment.analyzeSentiment(gratitude.message) },
          gratitude.type,
        ),
      );
    }

    for (let j = 0; j < extraRecognitions; j++) {
      results.push(
        giveRecognition(
          "goldenFistbumpMultiplier",
          gratitude.receivers[0].id,
          gratitude.message,
          gratitude.channel,
          { ...gratitude.values, sentiments: await sentiment.analyzeSentiment(gratitude.message) },
          gratitude.type,
        ),
      );
    }
  }
  return Promise.all(results);
}

async function validateAndSendGratitude(gratitude) {
  const errors = await gratitudeErrors(gratitude);
  let goldenRecognizeErrors = [];
  if (gratitude.type === goldenRecognizeEmoji) {
    goldenRecognizeErrors = await goldenGratitudeErrors(gratitude);
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
    gratitude.giver.tz,
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

async function receiverSlackNotification(gratitude, receiver) {
  const lifetimeTotal = await balance.lifetimeEarnings(receiver);
  const receiverBalance = await balance.currentBalance(receiver);
  let blocks = [];

  const receiverNotificationText = await composeReceiverNotificationText(
    gratitude,
    receiver,
    receiverBalance,
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
  receiverBalance,
) {
  if (gratitude.type === goldenRecognizeEmoji) {
    return `Congratulations, You just got the ${gratitude.type} from <@${gratitude.giver.id}> in <#${gratitude.channel}>, and are now the holder of the Golden Fistbump! You earned \`${gratitude.count}\` and your new balance is \`${receiverBalance}\`. While you hold the Golden Fistbump you will receive a 2X multiplier on all fistbumps received!\n>>>${gratitude.message}`;
  }

  const goldenRecognitionReceiver = await doesUserHoldGoldenRecognition(
    receiver,
    "recognizee",
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
  getGoldenFistbumpHolder,
  getPreviousXDaysOfRecognition,
  gratitudeReceiverIdsIn,
  gratitudeCountIn,
  isGratitudeAffordable,
  gratitudeErrors,
  goldenGratitudeErrors,
  trimmedGratitudeMessage,
  gratitudeTagsIn,
  giveGratitude,
  validateAndSendGratitude,
  giverSlackNotification,
  giverGoldenSlackNotification,
  doesUserHoldGoldenRecognition,
  composeReceiverNotificationText,
  receiverSlackNotification,
  groupUsers,
};
