const moment = require("moment-timezone");
const balance = require("../service/balance");
const deductionCollection = require("../database/deductionCollection");
const { ObjectId } = require("mongodb");

async function createDeduction(user, value, message = "") {
  let timestamp = new Date();
  return await deductionCollection.insert({
    user,
    timestamp,
    value,
    message,
  });
}

async function removeDeduction(id) {
  return await deductionCollection.remove({ _id: ObjectId(id) });
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
  return await deductionCollection.find(filter);
}

async function isBalanceSufficent(user, deductionValue) {
  return (await balance.currentBalance(user)) >= deductionValue;
}

module.exports = {
  createDeduction,
  removeDeduction,
  getDeductions,
  isBalanceSufficent,
};
