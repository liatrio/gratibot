const winston = require("../winston");
const moment = require("moment-timezone");
const deductionCollection = require("../database/deductionCollection");

async function createDeduction(user, value, message = "") {
  let timestamp = new Date();

  winston.debug("creating new deduction", {
    func: "service.deduction.createDeduction",
    callingUser: user,
    deductionValue: value,
  });

  return await deductionCollection.insert({
    user,
    timestamp,
    value,
    message,
  });
}

async function getDeductions(user, timezone = null, days = null) {
  let filter = { user };
  if (days && timezone) {
    let userDate = moment(Date.now()).tz(timezone);
    let midnight = userDate.startOf("day");
    midnight = midnight.subtract(days - 1, "days");
    filter.timestamp = {
      $gte: new Date(midnight),
    };
  }

  winston.debug(`retrieving ${user}'s deductions`, {
    func: "service.deduction.createDeduction",
    callingUser: user,
    timezone: timezone,
    days: days,
  });

  return await deductionCollection.find(filter);
}

module.exports = {
  createDeduction,
  getDeductions,
};
