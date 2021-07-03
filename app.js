const { App } = require("@slack/bolt");
const express = require("express");

const webserver = express();

webserver.get("/", (req, res) => {
  res.send("Gratibot is running!");
});

webserver.listen(process.env.PORT || 3000);

const app = new App({
  token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
  socketMode: true,
  appToken: process.env.APP_TOKEN,
});

var normalizedPath = require("path").join(__dirname, "features");
require("fs")
  .readdirSync(normalizedPath)
  .forEach(function (file) {
    require("./features/" + file)(app);
  });

(async () => {
  // Start your app
  await app.start();

  console.log("⚡️ Bolt app is running!");
})();
