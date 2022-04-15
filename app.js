const { App } = require("@slack/bolt");
const express = require("express");
const webserver = express();
const winston = require("winston");

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
  //
  // TODO

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

var normalizedPath = require("path").join(__dirname, "features");
require("fs")
  .readdirSync(normalizedPath)
  .forEach(function (file) {
    require("./features/" + file)(app);
  });

(async () => {
  await app.start();
  webserver.listen(process.env.PORT || 3000);

  winston.info("⚡️ Bolt app is running!");
})();
