const { App } = require("@slack/bolt");
const express = require("express");
const webserver = express();
const winston = require("./winston");
const client = require("./database/db");
const config = require("./config");
const stadium = require("./service/stadium");

const RECONCILIATION_INTERVAL_MS = 60 * 1000;

const app = new App({
  token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
  socketMode: true,
  appToken: process.env.APP_TOKEN,
});

webserver.get("/", (req, res) => {
  res.send("Gratibot is running!");
  winston.debug("root path response sent");
});

webserver.get("/health", async (req, res) => {
  const status_checks = {};

  // Check Slack API
  try {
    const slack_api_status = await app.client.api.test();
    if (slack_api_status.ok) {
      status_checks.slack_api = "OK";
    }
  } catch (e) {
    status_checks.slack_api = e.message;
  }

  // Check Slack Auth
  try {
    const slack_auth_status = await app.client.auth.test();
    if (slack_auth_status.ok) {
      status_checks.slack_auth = "OK";
    }
  } catch (e) {
    status_checks.slack_auth = e.message;
  }

  status_checks.slack_websocket_connection = app.receiver.client.badConnection
    ? "Connection Failed"
    : "OK";

  // Check Database Connection
  try {
    await client.db().command({ ping: 1 });
    status_checks.database = "OK";
  } catch (e) {
    status_checks.database = e.message;
  }

  for (const i in status_checks) {
    if (status_checks[i] !== "OK") {
      res.status(500).send(status_checks);
      winston.error("Health check failed", {
        status_checks,
      });
      return;
    }
  }
  res.send(status_checks);
  winston.debug("Health check passed");
});

async function notifyReconciliation(reconciliation) {
  const notifications = [];
  for (const record of reconciliation.refundedRecords) {
    notifications.push(
      app.client.chat.postMessage({
        channel: record.user,
        text: `Your interrupted Stadium redemption \`${record._id}\` did not reach Stadium. Your fistbumps were restored.`,
      }),
    );
  }
  for (const record of reconciliation.needsReviewRecords) {
    notifications.push(
      app.client.chat.postMessage({
        channel: record.user,
        text: `Your interrupted Stadium redemption \`${record._id}\` has an uncertain result. Your fistbumps remain held while an admin reviews it.`,
      }),
    );
  }
  const results = await Promise.allSettled(notifications);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    winston.error("Some Stadium reconciliation notifications failed", {
      func: "app.notifyReconciliation",
      failedCount: failed.length,
    });
  }
}

async function notifyOutstandingStadiumReviews() {
  const claims = await stadium.claimReviewNotifications();
  for (const { record, claimId } of claims) {
    const results = await Promise.allSettled(
      config.redemptionAdmins.map((admin) =>
        app.client.chat.postMessage({
          channel: admin,
          text: `Stadium redemption \`${record._id}\` for <@${record.user}> needs review. Run \`stadium review\`, then either \`stadium resolve ${record._id} fulfilled\` to confirm fulfillment or \`stadium resolve ${record._id} refund\` to restore the fistbumps.`,
        }),
      ),
    );
    const delivered = results.some((result) => result.status === "fulfilled");
    const failedCount = results.filter(
      (result) => result.status === "rejected",
    ).length;
    if (!delivered || failedCount) {
      winston.error("Some Stadium review admin notifications failed", {
        func: "app.notifyOutstandingStadiumReviews",
        redemptionId: record._id,
        failedCount,
        adminCount: config.redemptionAdmins.length,
      });
    }
    await stadium.completeReviewNotification(record._id, claimId, delivered);
  }
  return claims.length;
}

async function runStadiumReconciliation() {
  const reconciliation = await stadium.reconcilePending();
  await notifyReconciliation(reconciliation);
  const adminNotifications = await notifyOutstandingStadiumReviews();
  const details = {
    func: "app.runStadiumReconciliation",
    refunded: reconciliation.refunded,
    needsReview: reconciliation.needsReview,
    adminNotifications,
  };
  if (
    reconciliation.refunded ||
    reconciliation.needsReview ||
    adminNotifications
  ) {
    winston.info("Stadium redemption reconciliation completed", details);
  } else {
    winston.debug("Stadium redemption reconciliation completed", details);
  }
}

(async () => {
  try {
    await client.connect();

    await require("./service/rewardSeed").seedRewards();

    var normalizedPath = require("path").join(__dirname, "features");
    require("fs")
      .readdirSync(normalizedPath)
      .forEach(function (file) {
        require("./features/" + file)(app);
      });

    try {
      await runStadiumReconciliation();
    } catch (error) {
      winston.error("Startup Stadium reconciliation failed", {
        func: "app.startupReconciliation",
        error: error.message,
      });
    }
    await app.start();
    webserver.listen(process.env.PORT || 3000);
    const reconciliationTimer = setInterval(() => {
      runStadiumReconciliation().catch((error) => {
        winston.error("Periodic Stadium reconciliation failed", {
          func: "app.reconciliationTimer",
          error: error.message,
        });
      });
    }, RECONCILIATION_INTERVAL_MS);
    reconciliationTimer.unref();

    winston.info("⚡️ Bolt app is running!");
  } catch (e) {
    winston.error("Startup failed", { error: e.message });
    process.exit(1);
  }
})();
