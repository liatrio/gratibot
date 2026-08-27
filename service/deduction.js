const winston = require("../winston");
const moment = require("moment-timezone");
const balance = require("../service/balance");
const deductionCollection = require("../database/deductionCollection");
const deductionLockCollection = require("../database/deductionLockCollection");
const { ObjectId } = require("mongodb");
const { randomUUID } = require("crypto");

const LOCK_LEASE_MS = 5 * 60 * 1000;
const lockOwnerId = randomUUID();

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
  let databaseId = id;
  if (!(typeof id === "string" && id.startsWith("stadium:"))) {
    try {
      databaseId = new ObjectId(id);
    } catch {
      return { status: "not_found" };
    }
  }
  const refunded = await deductionCollection.findOneAndUpdate(
    { _id: databaseId, source: { $ne: "stadium" }, refund: false },
    { $set: { refund: true } },
  );
  if (refunded) return { status: "refunded" };

  const existing = await deductionCollection.findOne({ _id: databaseId });
  if (!existing) return { status: "not_found" };
  if (existing.source === "stadium") return { status: "stadium" };
  return { status: "already_refunded" };
}

function createLock(user, operationId, kind, now, leaseMs) {
  return {
    _id: user,
    operationId,
    kind,
    ownerId: lockOwnerId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + leaseMs),
  };
}

async function acquireLock(
  user,
  operationId,
  { kind = "ephemeral", leaseMs = LOCK_LEASE_MS } = {},
) {
  const stadiumReview = await deductionCollection.findOne({
    user,
    source: "stadium",
    status: "needs_review",
  });
  if (stadiumReview) {
    return {
      acquired: false,
      reason: "stadium-review",
      operationId: stadiumReview._id,
    };
  }

  const now = new Date();
  const lock = createLock(user, operationId, kind, now, leaseMs);
  try {
    await deductionLockCollection.insertOne(lock);
    return { acquired: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const replacement = { ...lock };
    delete replacement._id;
    const replaced = await deductionLockCollection.findOneAndUpdate(
      { _id: user, expiresAt: { $lte: now } },
      { $set: replacement },
    );
    if (replaced) return { acquired: true };

    const existing = await deductionLockCollection.findOne({ _id: user });
    return {
      acquired: false,
      reason:
        existing?.kind === "stadium-review" ? "stadium-review" : "in-progress",
      operationId: existing?.operationId,
    };
  }
}

async function releaseLock(user, operationId, { force = false } = {}) {
  const filter = { _id: user, operationId };
  if (!force) filter.ownerId = lockOwnerId;
  return deductionLockCollection.deleteOne(filter);
}

async function cleanupExpiredLocks(now = new Date()) {
  return deductionLockCollection.deleteMany({
    kind: { $in: ["ephemeral", "stadium-in-flight"] },
    expiresAt: { $lte: now },
  });
}

async function cleanupLegacyReviewLocks() {
  return deductionLockCollection.deleteMany({ kind: "stadium-review" });
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
  acquireLock,
  releaseLock,
  cleanupExpiredLocks,
  cleanupLegacyReviewLocks,
  LOCK_LEASE_MS,
};
