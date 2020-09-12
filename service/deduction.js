const moment = require('moment-timezone');
const deductionCollection = require('../database/deductionCollection');

async function createDeduction(user, value, message = '') {
  let timestamp = new Date();
  return await deductionCollection.insert(
  {
    user,
    timestamp,
    value,
    message,
  })
}

async function getDeductions(user, timezone = null, days = null) {
  let filter = { user }
  if(days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf('day');
    midnight = midnight.subtract(days - 1,'days');
    filter.timestamp =
      {
        $gte: new Date(midnight)
      }
  }
  return await deductionCollection.find(filter)
}

module.exports = {
    createDeduction,
    getDeductions
}
