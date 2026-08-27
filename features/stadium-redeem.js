const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const config = require("../config");
const winston = require("../winston");
const stadium = require("../service/stadium");
const { respondToUser } = require("../service/messageutils");

module.exports = function (app) {
  app.action({ action_id: "stadium_redeem_open" }, openRedemptionModal);
  app.view("stadium_redeem_submit", submitRedemption);
  app.message(
    /\bstadium review\b/i,
    anyOf(directMention, directMessage),
    reviewRedemptions,
  );
  app.message(
    /^(?!.*\brefund\b.*\bstadium\s+resolve\b).*\bstadium\s+resolve\b/is,
    anyOf(directMention, directMessage),
    resolveRedemption,
  );
};

async function openRedemptionModal({ ack, body, client }) {
  await ack();
  if (!config.stadium.enabled) {
    await notifyUser(
      client,
      body.user.id,
      "Stadium redemption is currently unavailable.",
    );
    return;
  }
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: stadium.buildRedemptionModal(),
    });
  } catch (error) {
    winston.error("Opening Stadium redemption modal failed", {
      func: "feature.stadium-redeem.openRedemptionModal",
      callingUser: body.user.id,
      error: error.message,
    });
    await notifyUser(
      client,
      body.user.id,
      "I couldn't open the Stadium redemption form. Please try again or contact an admin.",
    );
  }
}

async function submitRedemption({ ack, body, view, client }) {
  if (!config.stadium.enabled) {
    await ack();
    await notifyUser(
      client,
      body.user.id,
      "Stadium redemption is currently unavailable.",
    );
    return;
  }
  const amount = Number(
    view.state.values.stadium_amount.stadium_amount_value.value,
  );
  try {
    stadium.fistbumpsToPoints(amount);
  } catch (error) {
    await ack({
      response_action: "errors",
      errors: { stadium_amount: error.userMessage || error.message },
    });
    return;
  }
  await ack();
  const user = body.user.id;
  let userInfo;
  try {
    userInfo = await client.users.info({ user });
  } catch (error) {
    winston.error("Reading Slack email for Stadium redemption failed", {
      func: "feature.stadium-redeem.submitRedemption.usersInfo",
      callingUser: user,
      error: error.message,
    });
    await notifyUser(
      client,
      user,
      "I couldn't read your corporate email from Slack. Check your profile or contact a Gratibot admin.",
    );
    return;
  }
  if (!userInfo.ok || !userInfo.user?.profile?.email) {
    await notifyUser(
      client,
      user,
      "I couldn't read your corporate email from Slack. Check your profile or contact a Gratibot admin.",
    );
    return;
  }
  let result;
  try {
    result = await stadium.redeem({
      user,
      email: userInfo.user.profile.email,
      fistbumps: amount,
      redemptionId: `${body.team?.id || "team"}:${view.id}`,
    });
  } catch (error) {
    winston.error("Stadium redemption processing failed", {
      func: "feature.stadium-redeem.submitRedemption",
      callingUser: user,
      error: error.message,
    });
    const message =
      error instanceof stadium.StadiumError && error.userMessage
        ? error.userMessage
        : "I couldn't confirm the final status of your Stadium redemption. Please contact a Gratibot admin before trying again.";
    await notifyUser(client, user, message);
    return;
  }
  try {
    await handleResult(client, user, amount, result);
  } catch (error) {
    winston.error("Reporting Stadium redemption result failed", {
      func: "feature.stadium-redeem.submitRedemption",
      callingUser: user,
      redemptionId: result.id,
      status: result.status,
      error: error.message,
    });
    try {
      await notifyUser(
        client,
        user,
        "Your Stadium redemption was processed, but I couldn't deliver its confirmation. Please contact a Gratibot admin before trying again.",
      );
    } catch {
      // best-effort fallback after the original notification failed
    }
  }
}

async function handleResult(client, user, amount, result) {
  const messages = {
    insufficient:
      "Your current balance is no longer high enough for that redemption.",
    duplicate:
      "This redemption was already submitted; no additional points were sent.",
    failed:
      "Stadium did not accept the redemption. Your fistbumps were restored.",
    needs_review:
      "Stadium's result was uncertain. Your fistbumps are held while an admin reviews it; Gratibot will not retry automatically.",
    resolution_conflict:
      "Stadium confirmed the points after this redemption had already been resolved locally. Do not retry; a Gratibot admin has been notified.",
  };
  if (result.status === "fulfilled") {
    const link = config.stadium.storeUrl
      ? ` Sign in with SSO at <${config.stadium.storeUrl}|Stadium>.`
      : " Sign in to Stadium with SSO to use them.";
    await notifyUser(
      client,
      user,
      `${amount} fistbumps were exchanged for ${result.stadiumPoints} Stadium points.${link}${result.orderNumber ? ` Order: \`${result.orderNumber}\`` : ""}`,
    );
    return;
  }
  const message =
    result.status === "busy" && result.reason === "stadium-review"
      ? "A Stadium redemption is awaiting admin review. You can redeem again after an admin resolves it."
      : result.status === "busy"
        ? "You already have a redemption in progress. Please try again shortly."
        : messages[result.status];
  await notifyUser(client, user, message);
  if (result.status === "needs_review") {
    await notifyReviewAdmins(client, user, result.id);
  }
  if (result.status === "resolution_conflict") {
    await notifyAdmins(
      client,
      `Stadium redemption \`${result.id}\` for <@${user}> was confirmed as order \`${result.orderNumber}\` after its local status became ${result.terminalStatus}. Investigate before the employee redeems again.`,
    );
  }
}

async function reviewRedemptions({ message, client }) {
  if (!config.redemptionAdmins.includes(message.user)) {
    await respondToUser(client, message, {
      text: "Only `Redemption Admins` can review Stadium redemptions.",
    });
    return;
  }
  const records = await stadium.reviewRedemptions();
  const text = records.length
    ? records
        .map(
          (record) =>
            `\`${record._id}\` — <@${record.user}>, ${record.value} fistbumps${record.stadium?.orderNumber ? `, Stadium order ${record.stadium.orderNumber}` : ""}`,
        )
        .join("\n")
    : "No Stadium redemptions need review.";
  await respondToUser(client, message, { text });
}

async function resolveRedemption({ message, client }) {
  if (!config.redemptionAdmins.includes(message.user)) {
    await respondToUser(client, message, {
      text: "Only `Redemption Admins` can resolve Stadium redemptions.",
    });
    return;
  }
  const match = message.text.match(
    /\bstadium resolve\s+`?(stadium:[^\s`]+)`?\s+(fulfilled|refund)\s*$/i,
  );
  if (!match) {
    await respondToUser(client, message, {
      text: "Usage: `stadium resolve <id> fulfilled` or `stadium resolve <id> refund`",
    });
    return;
  }
  const result = await stadium.resolveRedemption(
    match[1],
    match[2].toLowerCase(),
    message.user,
  );
  const text =
    result.status === "not_found"
      ? "That unresolved Stadium redemption was not found."
      : `Stadium redemption \`${match[1]}\` was marked ${result.status}.`;
  await respondToUser(client, message, { text });
  if (result.record) {
    await notifyUser(
      client,
      result.record.user,
      result.status === "refunded"
        ? `Your Stadium redemption \`${match[1]}\` was reviewed and your fistbumps were restored.`
        : `Your Stadium redemption \`${match[1]}\` was reviewed and confirmed fulfilled.`,
    );
  }
}

async function notifyUser(client, user, text) {
  return client.chat.postMessage({ channel: user, text });
}

async function notifyReviewAdmins(client, user, redemptionId) {
  let claim;
  try {
    claim = await stadium.claimReviewNotification(redemptionId);
    if (!claim) return;
    const delivered = await notifyAdmins(
      client,
      `Stadium redemption \`${redemptionId}\` for <@${user}> needs review. Run \`stadium review\`, then either \`stadium resolve ${redemptionId} fulfilled\` to confirm fulfillment or \`stadium resolve ${redemptionId} refund\` to restore the fistbumps.`,
    );
    await stadium.completeReviewNotification(
      redemptionId,
      claim.claimId,
      delivered,
    );
  } catch (error) {
    winston.error("Scheduling Stadium admin notification failed", {
      func: "feature.stadium-redeem.notifyReviewAdmins",
      redemptionId,
      error: error.message,
    });
  }
}

async function notifyAdmins(client, text) {
  const results = await Promise.allSettled(
    config.redemptionAdmins.map((admin) =>
      client.chat.postMessage({ channel: admin, text }),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    winston.error("Some Stadium admin notifications failed", {
      func: "feature.stadium-redeem.notifyAdmins",
      failedCount: failed.length,
    });
  }
  return results.some((result) => result.status === "fulfilled");
}
