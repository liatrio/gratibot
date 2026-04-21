const winston = require("../winston");
const moment = require("moment-timezone");
const balance = require("../service/balance");
const deductionCollection = require("../database/deductionCollection");
const { ObjectId } = require("mongodb");

async function createDeduction(user, value, message = "") {
  let timestamp = new Date();
  let refund = false;

  winston.debug("creating new deduction", {
    func: "service.deduction.createDeduction",
    callingUser: user,
    deductionValue: value,
  });

  const result = await deductionCollection.insertOne({
    user,
    timestamp,
    refund,
    value: Number(value),
    message,
  });
  return result.insertedId;
}

async function refundDeduction(id) {
  return await deductionCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { refund: true } },
  );
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
    func: "service.deduction.getDeductions",
    callingUser: user,
    timezone: timezone,
    days: days,
  });

  return await deductionCollection.find(filter).toArray();
}

async function isBalanceSufficient(user, deductionValue) {
  return (await balance.currentBalance(user)) >= deductionValue;
}

module.exports = {
  createDeduction,
  refundDeduction,
  getDeductions,
  isBalanceSufficient,
};
