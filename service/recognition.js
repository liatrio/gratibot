const moment = require('moment-timezone');
const recognitionCollection = require('../database/recognitionCollection');

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

module.exports = {
    giveRecognition,
    countRecognitionsReceived,
    countRecognitionsGiven,
    getPreviousXDaysOfRecognition
}
