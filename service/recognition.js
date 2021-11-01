const config = require("../config");
const moment = require("moment-timezone");
const recognitionCollection = require("../database/recognitionCollection");
const balance = require("./balance");
const { GratitudeError } = require("./errors");

const { recognizeEmoji, maximum, minimumMessageLength, botName } = config;

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const gratitudeEmojiRegex = new RegExp(config.recognizeEmoji, "g");
const multiplierRegex = /x([0-9]+)/;

// TODO Can we add a 'count' field to the recognition?
async function giveRecognition(
  recognizer,
  recognizee,
  message,
  channel,
  values
) {
  let timestamp = new Date();
  return await recognitionCollection.insert({
    recognizer: recognizer,
    recognizee: recognizee,
    timestamp: timestamp,
    message: message,
    channel: channel,
    values: values,
  });
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
  return await recognitionCollection.find(filter);
}

function gratitudeReceiverIdsIn(text) {
  return (text.match(userRegex) || []).map((userMention) =>
    userMention.slice(2, -1)
  );
}

function gratitudeCountIn(text) {
  const emojiCount = (text.match(gratitudeEmojiRegex) || []).length;
  const multiplier = text.match(multiplierRegex)
    ? text.match(multiplierRegex)[1]
    : 1;
  return emojiCount * multiplier;
}

function gratitudeTagsIn(text) {
  return (text.match(tagRegex) || []).map((tag) => tag.slice(1));
}

function trimmedGratitudeMessage(text) {
  return text.replace(userRegex, "").replace(generalEmojiRegex, "");
}

async function isGratitudeAffordable(gratitude) {
  const dailyGratitudeRemaining = await balance.dailyGratitudeRemaining(
    gratitude.giver.id,
    gratitude.giver.tz
  );
  const gratitudeCost = gratitude.receivers.length * gratitude.count;
  return dailyGratitudeRemaining >= gratitudeCost;
}

async function gratitudeErrors(gratitude) {
  return [
    gratitude.receivers.length === 0
      ? "- Mention who you want to recognize with @user"
      : "",
    gratitude.receivers.find((x) => x.id == gratitude.giver.id)
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
  for (let i = 0; i < gratitude.receivers.length; i++) {
    for (let j = 0; j < gratitude.count; j++) {
      results.push(
        giveRecognition(
          gratitude.giver.id,
          gratitude.receivers[i].id,
          gratitude.text,
          gratitude.channel,
          gratitude.tags
        )
      );
    }
  }
  return Promise.all(results);
}

async function validateAndSendGratitude(gratitude) {
  const errors = await gratitudeErrors(gratitude);
  if (errors.length > 0) {
    throw new GratitudeError(errors);
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
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        totalGratitudeValue > 1
          ? `Your \`${totalGratitudeValue}\` ${recognizeEmoji} have been sent. You have \`${gratitudeRemaining}\` left to give today.`
          : `Your \`${totalGratitudeValue}\` ${recognizeEmoji} has been sent. You have \`${gratitudeRemaining}\` left to give today.`,
    },
  });
  return { blocks };
}

async function receiverSlackNotification(gratitude, receiver) {
  const lifetimeTotal = await balance.lifetimeEarnings(receiver);
  const receiverBalance = await balance.currentBalance(receiver);
  let blocks = [];
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `You just got a ${gratitude.type} from <@${gratitude.giver.id}> in <#${gratitude.channel}>. You earned \`${gratitude.count}\` and your new balance is \`${receiverBalance}\`\n>>>${gratitude.message}`,
    },
  });

  if (gratitude.count == lifetimeTotal) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `I noticed this is your first time receiving a ${recognizeEmoji}. Check out <https://liatrio.atlassian.net/wiki/spaces/LE/pages/817857117/Redeeming+Fistbumps|Confluence> to see what they can be used for, or try running \`<@${botName}> help\` for more information about me.`,
      },
    });
  }
  return { blocks };
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
  gratitudeErrors,
  trimmedGratitudeMessage,
  gratitudeTagsIn,
  giveGratitude,
  validateAndSendGratitude,
  giverSlackNotification,
  receiverSlackNotification,
};
