const winston = require("../winston");
const config = require("../config");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

async function respondToFirstFriday({ message, client }) {
  winston.info("@gratibot liatrio love Called", {
    callingUser: message.user,
    slackMessage: message.text,
  });

  if (!config.firstFridayAdmins.includes(message.user)) {
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: "Only authorized admins can toggle First Friday mode",
    });
    return;
  }

  config.firstFridayEnabled = !config.firstFridayEnabled;
  const status = config.firstFridayEnabled ? "enabled" : "disabled";

  await client.chat.postMessage({
    channel: message.channel,
    text: `First Friday mode has been ${status}`,
  });
}

module.exports = function (app) {
  app.message(
    "liatrio love",
    anyOf(directMention, directMessage()),
    respondToFirstFriday,
  );
};
