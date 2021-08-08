const { App } = require("@slack/bolt");
const express = require("express");
const db = require('./database/db');
const webserver = express();

const app = new App({
  token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
  socketMode: true,
  appToken: process.env.APP_TOKEN,
});

webserver.get("/", (req, res) => {
  res.send("Gratibot is running!");
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

  // Check Database Connection
  //
  // TODO

  for (i in status_checks) {
    if (status_checks[i] !== "OK") {
      res.status(500).send(status_checks);
      return;
    }
  }
  res.send(status_checks);
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

  console.log("⚡️ Bolt app is running!");
})();

