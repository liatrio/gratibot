const config = require("../config")
const moment = require('moment-timezone');
const recognitionCollection = require('../database/recognitionCollection');
const balance = require("./balance");

const { recognizeEmoji, maximum, minimumMessageLength, reactionEmoji } = config;

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;
const generalEmojiRegex = /:([a-z-_']+):/g;
const gratitudeEmojiRegex = new RegExp(config.recognizeEmoji, "g");

// TODO Can we add a 'count' field to the recognition?
async function giveRecognition(recognizer, recognizee, message, channel, values) {
  console.debug('Sending a recognition given to database');
  let timestamp = new Date();
  return await recognitionCollection.insert(
  {
    recognizer: recognizer,
    recognizee: recognizee,
    timestamp: timestamp,
    message: message,
    channel: channel,
    values: values
  })
}

async function countRecognitionsReceived(user, timezone = null, days = null) {
  console.debug('Getting the recognitions a user received');
  let filter = {recognizee:user}
  if(days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf('day');
    midnight = midnight.subtract(days - 1,'days');
    filter.timestamp =
      {
        $gte: new Date(midnight)
      }
  }
  return await recognitionCollection.count(filter)
}

async function countRecognitionsGiven (user, timezone = null, days = null) {
  console.debug('Getting the recognitions a user gave');
  let filter = {recognizer:user}
  if(days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf('day');
    midnight = midnight.subtract(days - 1,'days');
    filter.timestamp =
      {
        $gte: new Date(midnight)
      }
  }
  return await recognitionCollection.count(filter)
}

async function getPreviousXDaysOfRecognition(timezone = null, days = null) {
  //get only the entries from the specifc day from midnight
  let filter = {}
  if(days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf('day');
    midnight = midnight.subtract(days - 1,'days');
    filter.timestamp =
      {
        $gte: new Date(midnight)
      }
  }
  return await recognitionCollection.find(filter);
}

function gratitudeReceiverIdsIn(text) {
  return (text.match(userRegex) || [])
    .map((userMention) => userMention.slice(2, -1));
}

function gratitudeCountIn(text) {
  return (text.match(gratitudeEmojiRegex) || []).length;
}

function gratitudeTagsIn(text) {
  return (text.match(tagRegex) || [])
    .map((tag) => tag.slice(1)); 
}

function trimmedGratitudeMessage(text) {
  return text
    .replace(userRegex, "")
    .replace(generalEmojiRegex, "");
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
      ? "- You can' give recognition to guest users"
      : "",
    gratitude.trimmedMessage.length < minimumMessageLength
      ? `- Your message must be at least ${minimumMessageLength} characters`
      : "",
    !(await isGratitudeAffordable(gratitude))
      ? `- A maximum of ${maximum} ${recognizeEmoji} can be sent per day`
      : "",
  ]
    .filter((x) => x !== "")
    .join("\n");
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
 *   tags [string],
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
    giveGratitude
}
