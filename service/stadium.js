const config = require("../config");
const winston = require("../winston");
const deduction = require("./deduction");
const balance = require("./balance");
const deductionCollection = require("../database/deductionCollection");
const { randomUUID } = require("crypto");

const CORPORATE_DOMAIN = "liatrio.com";
const EMAIL_SOURCES = ["modal", "slack"];
const REQUEST_TIMEOUT_MS = 10000;
const REVIEW_NOTIFICATION_CLAIM_MS = 5 * 60 * 1000;
const REVIEW_NOTIFICATION_RETRY_MS = 15 * 60 * 1000;
let tokenCache = null;

class StadiumError extends Error {
  constructor(message, classification, details = {}) {
    super(message);
    this.name = "StadiumError";
    this.classification = classification;
    this.details = details;
    this.userMessage = details.userMessage;
  }
}

function validateConfiguration(stadiumConfig = config.stadium) {
  const required = [
    "apiBaseUrl",
    "clientId",
    "clientSecret",
    "storeNumber",
    "paymentMethod",
    "billingCountry",
    "billingZipcode",
  ];
  const missing = required.filter((key) => !stadiumConfig[key]);
  if (missing.length) {
    throw new StadiumError(
      `Missing Stadium configuration: ${missing.join(", ")}`,
      "definite",
    );
  }
  const paymentMethods = stadiumConfig.paymentMethod
    .split(",")
    .map((method) => method.trim());
  if (
    paymentMethods.some(
      (method) => !["use_wallet_money", "use_global_point"].includes(method),
    )
  ) {
    throw new StadiumError("Invalid Stadium payment method.", "definite");
  }
  validateEmailSource(stadiumConfig.emailSource);
  validateConversionConfiguration(stadiumConfig);
}

function validateEmailSource(emailSource = config.stadium.emailSource) {
  if (!EMAIL_SOURCES.includes(emailSource)) {
    throw new StadiumError("Invalid Stadium email source.", "definite", {
      userMessage:
        "Stadium redemption is unavailable because its email settings are invalid. Please contact a Gratibot admin.",
    });
  }
  return emailSource;
}

function validateConversionConfiguration(stadiumConfig = config.stadium) {
  const {
    fistbumpsPerUnit,
    pointsPerUnit,
    minimumFistbumps,
    maximumFistbumps,
  } = stadiumConfig;
  const invalid =
    !Number.isSafeInteger(fistbumpsPerUnit) ||
    fistbumpsPerUnit < 1 ||
    !Number.isSafeInteger(pointsPerUnit) ||
    pointsPerUnit < 1 ||
    !Number.isSafeInteger(minimumFistbumps) ||
    minimumFistbumps < 1 ||
    minimumFistbumps % fistbumpsPerUnit !== 0 ||
    (maximumFistbumps !== null &&
      (!Number.isSafeInteger(maximumFistbumps) ||
        maximumFistbumps < minimumFistbumps));
  if (invalid) {
    throw new StadiumError(
      "Invalid Stadium conversion configuration.",
      "definite",
      {
        userMessage:
          "Stadium redemption is unavailable because its conversion settings are invalid. Please contact a Gratibot admin.",
      },
    );
  }
}

function normalizeCorporateEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[0] || parts[1] !== CORPORATE_DOMAIN) {
    throw new StadiumError(
      `Redemption requires an @${CORPORATE_DOMAIN} email address.`,
      "definite",
      {
        userMessage: `Enter a valid @${CORPORATE_DOMAIN} email address.`,
      },
    );
  }
  return normalized;
}

function fistbumpsToPoints(amount, stadiumConfig = config.stadium) {
  validateConversionConfiguration(stadiumConfig);
  const fistbumps = Number(amount);
  const {
    fistbumpsPerUnit,
    pointsPerUnit,
    minimumFistbumps,
    maximumFistbumps,
  } = stadiumConfig;
  if (
    !Number.isSafeInteger(fistbumps) ||
    fistbumps < minimumFistbumps ||
    fistbumps % fistbumpsPerUnit !== 0 ||
    (maximumFistbumps !== null && fistbumps > maximumFistbumps)
  ) {
    const multiple =
      fistbumpsPerUnit > 1 ? ` in multiples of ${fistbumpsPerUnit}` : "";
    throw new StadiumError(
      `Enter a valid whole-number fistbump amount${multiple}.`,
      "definite",
    );
  }
  return (fistbumps / fistbumpsPerUnit) * pointsPerUnit;
}

function buildRedemptionModal(
  currentBalance = null,
  stadiumConfig = config.stadium,
) {
  const emailSource = validateEmailSource(stadiumConfig.emailSource);
  validateConversionConfiguration(stadiumConfig);
  const hasCurrentBalance = Number.isSafeInteger(currentBalance);
  const configuredMaximum = stadiumConfig.maximumFistbumps;
  const effectiveMaximum = hasCurrentBalance
    ? configuredMaximum !== null
      ? Math.min(currentBalance, configuredMaximum)
      : currentBalance
    : configuredMaximum;
  const balanceText = hasCurrentBalance
    ? `\n*Balance:* ${currentBalance} fistbumps`
    : "\nYour available balance will be checked when you submit.";
  return {
    type: "modal",
    callback_id: "stadium_redeem_submit",
    private_metadata: JSON.stringify({ emailSource }),
    title: { type: "plain_text", text: "Stadium redemption" },
    submit: { type: "plain_text", text: "Redeem" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Exchange fistbumps for Stadium points. After your gift is created, open Stadium and select *Redeem Gift* to add the points to your account.${balanceText}\n*Rate:* ${stadiumConfig.fistbumpsPerUnit} fistbump(s) = ${stadiumConfig.pointsPerUnit} Stadium point(s)`,
        },
      },
      ...(emailSource === "modal"
        ? [
            {
              type: "input",
              block_id: "stadium_email",
              label: {
                type: "plain_text",
                text: "Your Liatrio email address",
              },
              hint: {
                type: "plain_text",
                text: "Enter your own @liatrio.com email address.",
              },
              element: {
                type: "email_text_input",
                action_id: "stadium_email_value",
                placeholder: {
                  type: "plain_text",
                  text: "name@liatrio.com",
                },
              },
            },
          ]
        : []),
      {
        type: "input",
        block_id: "stadium_amount",
        label: { type: "plain_text", text: "Fistbumps to redeem" },
        element: {
          type: "number_input",
          action_id: "stadium_amount_value",
          is_decimal_allowed: false,
          min_value: String(stadiumConfig.minimumFistbumps),
          ...(effectiveMaximum !== null &&
          effectiveMaximum >= stadiumConfig.minimumFistbumps
            ? { max_value: String(effectiveMaximum) }
            : {}),
        },
      },
    ],
  };
}

function resultFromCurrentRecord(record, id, fulfillment = {}) {
  if (record?.status === "needs_review") {
    return { status: "needs_review", id };
  }
  if (["failed", "refunded"].includes(record?.status)) {
    if (fulfillment.orderNumber) {
      return {
        status: "resolution_conflict",
        id,
        terminalStatus: record.status,
        ...fulfillment,
      };
    }
    return { status: "failed", id };
  }
  if (record?.status === "fulfilled") {
    return {
      status: "fulfilled",
      id,
      stadiumPoints: record.stadiumPoints,
      orderNumber: record.stadium?.orderNumber || fulfillment.orderNumber,
      paymentState: record.stadium?.paymentState || fulfillment.paymentState,
    };
  }
  throw new StadiumError(
    "Stadium redemption state changed unexpectedly.",
    "ambiguous",
    { redemptionId: id },
  );
}

async function recordLateFulfillment(id, fulfillment, stadiumPoints) {
  const now = new Date();
  const update = {
    status: "fulfilled",
    updatedAt: now,
    stadium: fulfillment,
    lateConfirmationAt: now,
  };
  const fulfilled = await deductionCollection.updateOne(
    { _id: id, status: "needs_review" },
    { $set: update },
  );
  if (fulfilled.modifiedCount) {
    return { status: "fulfilled", stadium: fulfillment, stadiumPoints };
  }

  const current = await deductionCollection.findOne({ _id: id });
  if (current?.status === "fulfilled" && !current.stadium?.orderNumber) {
    await deductionCollection.updateOne(
      { _id: id, status: "fulfilled" },
      { $set: { stadium: fulfillment, lateConfirmationAt: now } },
    );
    current.stadium = fulfillment;
  }
  if (["failed", "refunded"].includes(current?.status)) {
    winston.error("Late Stadium fulfillment conflicts with terminal state", {
      func: "service.stadium.recordLateFulfillment",
      redemptionId: id,
      terminalStatus: current.status,
      orderNumber: fulfillment.orderNumber,
    });
  }
  return current;
}

async function request(path, options, classification, stadiumConfig) {
  let response;
  try {
    response = await fetch(`${stadiumConfig.apiBaseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new StadiumError(
      `Stadium request did not complete: ${error.message}`,
      classification,
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

async function getAccessToken(stadiumConfig = config.stadium) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.value;
  }
  validateConfiguration(stadiumConfig);
  const { response, body } = await request(
    "/oauth/token",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: stadiumConfig.clientId,
        client_secret: stadiumConfig.clientSecret,
      }),
    },
    "definite",
    stadiumConfig,
  );
  if (!response.ok || !body?.token) {
    throw new StadiumError("Stadium authentication failed.", "definite", {
      httpStatus: response.status,
    });
  }
  const expiresAt = body.expires_at
    ? Number(body.expires_at) * 1000
    : Date.now() + Number(body.expires_in || 3600) * 1000;
  tokenCache = { value: body.token, expiresAt };
  return tokenCache.value;
}

async function sendPoints(
  { email, points, redemptionId },
  stadiumConfig = config.stadium,
) {
  const token = await getAccessToken(stadiumConfig);
  const payload = {
    store_number: stadiumConfig.storeNumber,
    contact_emails: email,
    organizer_share: points,
    expected_count: 1,
    send_shop_points: true,
    treat_name: `Gratibot redemption ${redemptionId}`,
    rlp_message: "Points redeemed from Gratibot fistbumps.",
    payment_method: stadiumConfig.paymentMethod
      .split(",")
      .map((method) => method.trim()),
    auto_accept_points: true,
    billing_country: stadiumConfig.billingCountry,
    billing_zipcode: stadiumConfig.billingZipcode,
  };
  const { response, body } = await request(
    "/send_points",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "ambiguous",
    stadiumConfig,
  );

  if (!response.ok) {
    if (response.status === 401) tokenCache = null;
    const classification =
      response.status >= 400 && response.status < 500 && response.status !== 429
        ? "definite"
        : "ambiguous";
    throw new StadiumError(
      "Stadium rejected the points request.",
      classification,
      {
        httpStatus: response.status,
      },
    );
  }
  if (!body?.number || body.payment_state !== "paid") {
    throw new StadiumError(
      "Stadium returned an unconfirmed fulfillment response.",
      "ambiguous",
      { orderNumber: body?.number, paymentState: body?.payment_state },
    );
  }
  return { orderNumber: body.number, paymentState: body.payment_state };
}

async function redeem({ user, email, fistbumps, redemptionId }) {
  const stadiumPoints = fistbumpsToPoints(fistbumps);
  const corporateEmail = normalizeCorporateEmail(email);
  const id = `stadium:${redemptionId}`;
  const lockResult = await deduction.acquireLock(user, id, {
    kind: "stadium-in-flight",
  });
  if (!lockResult.acquired) {
    return {
      status: "busy",
      reason: lockResult.reason,
      operationId: lockResult.operationId,
    };
  }

  let inserted = false;
  let dispatchStarted = false;
  try {
    if ((await balance.currentBalance(user)) < fistbumps) {
      await deduction.releaseLock(user, id);
      return { status: "insufficient" };
    }
    const now = new Date();
    await deductionCollection.insertOne({
      _id: id,
      source: "stadium",
      status: "reserved",
      user,
      corporateEmail,
      value: fistbumps,
      stadiumPoints,
      ratio: {
        fistbumpsPerUnit: config.stadium.fistbumpsPerUnit,
        pointsPerUnit: config.stadium.pointsPerUnit,
      },
      refund: false,
      timestamp: now,
      updatedAt: now,
    });
    inserted = true;
    const sending = await deductionCollection.updateOne(
      { _id: id, status: "reserved" },
      { $set: { status: "sending", updatedAt: new Date() } },
    );
    if (!sending.modifiedCount) {
      const current = await deductionCollection.findOne({ _id: id });
      await deduction.releaseLock(user, id);
      return resultFromCurrentRecord(current, id);
    }
    dispatchStarted = true;
    const fulfillment = await sendPoints({
      email: corporateEmail,
      points: stadiumPoints,
      redemptionId: id,
    });
    const fulfilled = await deductionCollection.updateOne(
      { _id: id, status: "sending" },
      {
        $set: {
          status: "fulfilled",
          updatedAt: new Date(),
          stadium: fulfillment,
        },
      },
    );
    if (!fulfilled.modifiedCount) {
      const current = await recordLateFulfillment(
        id,
        fulfillment,
        stadiumPoints,
      );
      await deduction.releaseLock(user, id);
      return resultFromCurrentRecord(current, id, fulfillment);
    }
    await deduction.releaseLock(user, id);
    return { status: "fulfilled", id, stadiumPoints, ...fulfillment };
  } catch (error) {
    if (!inserted) {
      await deduction.releaseLock(user, id);
      if (error.code === 11000) return { status: "duplicate", id };
      throw error;
    }
    const classification =
      error.classification || (dispatchStarted ? "ambiguous" : "definite");
    const nextStatus =
      classification === "definite" ? "failed" : "needs_review";
    const transitionTime = new Date();
    const update = {
      status: nextStatus,
      updatedAt: transitionTime,
      ...(classification === "definite" ? { refund: true } : {}),
      ...(classification === "ambiguous"
        ? {
            reviewNotification: {
              nextAttemptAt: transitionTime,
            },
          }
        : {}),
      ...(error.details !== undefined ? { stadium: error.details } : {}),
    };
    const transitionableStatuses = dispatchStarted
      ? ["sending"]
      : ["reserved", "sending"];
    const transitioned = await deductionCollection.updateOne(
      { _id: id, status: { $in: transitionableStatuses } },
      { $set: update },
    );
    if (!transitioned.modifiedCount) {
      const current = await deductionCollection.findOne({ _id: id });
      await deduction.releaseLock(user, id);
      return resultFromCurrentRecord(current, id);
    }
    if (classification === "definite") {
      await deduction.releaseLock(user, id);
      return { status: "failed", id };
    }
    winston.error("Stadium fulfillment needs admin review", {
      func: "service.stadium.redeem",
      callingUser: user,
      redemptionId: id,
      error: error.message,
    });
    await deduction.releaseLock(user, id);
    return { status: "needs_review", id };
  }
}

async function reviewRedemptions() {
  return deductionCollection
    .find({ source: "stadium", status: "needs_review" })
    .sort({ timestamp: 1 })
    .toArray();
}

function reviewNotificationDueFilter(now) {
  return {
    source: "stadium",
    status: "needs_review",
    "reviewNotification.notifiedAt": { $exists: false },
    $and: [
      {
        $or: [
          { "reviewNotification.nextAttemptAt": { $exists: false } },
          { "reviewNotification.nextAttemptAt": { $lte: now } },
        ],
      },
      {
        $or: [
          { "reviewNotification.claimUntil": { $exists: false } },
          { "reviewNotification.claimUntil": { $lte: now } },
        ],
      },
    ],
  };
}

async function claimReviewNotification(id, now = new Date()) {
  const claimId = randomUUID();
  const record = await deductionCollection.findOneAndUpdate(
    { _id: id, ...reviewNotificationDueFilter(now) },
    {
      $set: {
        "reviewNotification.claimId": claimId,
        "reviewNotification.claimUntil": new Date(
          now.getTime() + REVIEW_NOTIFICATION_CLAIM_MS,
        ),
        "reviewNotification.lastAttemptAt": now,
      },
    },
    { returnDocument: "after" },
  );
  return record ? { record, claimId } : null;
}

async function claimReviewNotifications(now = new Date()) {
  const records = await deductionCollection
    .find(reviewNotificationDueFilter(now))
    .toArray();
  const claims = await Promise.all(
    records.map((record) => claimReviewNotification(record._id, now)),
  );
  return claims.filter(Boolean);
}

async function completeReviewNotification(
  id,
  claimId,
  delivered,
  now = new Date(),
) {
  const update = delivered
    ? {
        $set: { "reviewNotification.notifiedAt": now },
        $unset: {
          "reviewNotification.claimId": "",
          "reviewNotification.claimUntil": "",
          "reviewNotification.nextAttemptAt": "",
        },
      }
    : {
        $set: {
          "reviewNotification.nextAttemptAt": new Date(
            now.getTime() + REVIEW_NOTIFICATION_RETRY_MS,
          ),
        },
        $unset: {
          "reviewNotification.claimId": "",
          "reviewNotification.claimUntil": "",
        },
      };
  return deductionCollection.updateOne(
    {
      _id: id,
      source: "stadium",
      status: "needs_review",
      "reviewNotification.claimId": claimId,
    },
    update,
  );
}

async function resolveRedemption(id, resolution, admin) {
  if (!["fulfilled", "refund"].includes(resolution)) {
    return { status: "invalid" };
  }
  const record = await deductionCollection.findOne({
    _id: id,
    source: "stadium",
    status: "needs_review",
  });
  if (!record) return { status: "not_found" };
  const now = new Date();
  const nextStatus = resolution === "refund" ? "refunded" : "fulfilled";
  const result = await deductionCollection.updateOne(
    { _id: id, status: "needs_review" },
    {
      $set: {
        status: nextStatus,
        refund: resolution === "refund",
        updatedAt: now,
        resolution: { admin, action: resolution, timestamp: now },
      },
    },
  );
  if (!result.modifiedCount) return { status: "not_found" };
  await deduction.releaseLock(record.user, id, { force: true });
  return { status: nextStatus, record };
}

async function reconcilePending() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - deduction.LOCK_LEASE_MS);
  const reserved = await deductionCollection
    .find({
      source: "stadium",
      status: "reserved",
      updatedAt: { $lte: staleBefore },
    })
    .toArray();
  const refundedRecords = [];
  for (const record of reserved) {
    const result = await deductionCollection.updateOne(
      { _id: record._id, status: "reserved", updatedAt: record.updatedAt },
      { $set: { status: "failed", refund: true, updatedAt: now } },
    );
    if (result.modifiedCount) {
      await deduction.releaseLock(record.user, record._id, { force: true });
      refundedRecords.push(record);
    }
  }
  const sending = await deductionCollection
    .find({
      source: "stadium",
      status: "sending",
      updatedAt: { $lte: staleBefore },
    })
    .toArray();
  const needsReviewRecords = [];
  for (const record of sending) {
    const result = await deductionCollection.updateOne(
      { _id: record._id, status: "sending", updatedAt: record.updatedAt },
      {
        $set: {
          status: "needs_review",
          updatedAt: now,
          reviewNotification: { nextAttemptAt: now },
        },
      },
    );
    if (result.modifiedCount) {
      await deduction.releaseLock(record.user, record._id, { force: true });
      needsReviewRecords.push(record);
    }
  }
  await deduction.cleanupLegacyReviewLocks();
  await deduction.cleanupExpiredLocks(now);
  return {
    refunded: refundedRecords.length,
    needsReview: needsReviewRecords.length,
    refundedRecords,
    needsReviewRecords,
  };
}

function resetTokenCache() {
  tokenCache = null;
}

module.exports = {
  StadiumError,
  validateEmailSource,
  normalizeCorporateEmail,
  fistbumpsToPoints,
  buildRedemptionModal,
  getAccessToken,
  sendPoints,
  redeem,
  reviewRedemptions,
  claimReviewNotification,
  claimReviewNotifications,
  completeReviewNotification,
  resolveRedemption,
  reconcilePending,
  resetTokenCache,
};
