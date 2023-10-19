const { App } = require("@slack/bolt");
const express = require("express");
const webserver = express();
const winston = require("./winston");
const {
  recognizeEmoji,
  maximum,
  reactionEmoji,
  goldenRecognizeEmoji,
  usersDeduction,
  slashCommand,
} = require("./config");
const { respondToHelp, respondToEasterEgg } = require("./features/help");
const { respondToBalance } = require("./features/balance");
const { createDeduction } = require("./service/deduction");

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

// var normalizedPath = require("path").join(__dirname, "features");
// require("fs")
//   .readdirSync(normalizedPath)
//   .forEach(function (file) {
//     require("./features/" + file)(app);
//   });

/// ////////////////////////////////////////////////////////////
// Slash Command Logic //
/// ////////////////////////////////////////////////////////////

function parseCommand(command) {
  const parsed = {
    // Default values for each parameter
    valid: false, // indicates if a command is valid
    command: "", // holds the type of command
    user: "", // holds the value for the user that will be targeted
  };

  const raw = command.text.split(" "); // raw command as an array
  parsed.command = raw[0];

  switch (raw[0]) {
    case "help":
      parsed.valid = true; // command is valid, but doesn't require any additional info
      break;
    case "thunderfury":
      parsed.valid = true;
      break;
    case "balance":
      parsed.valid = true;
      break;
    case "deduct":
      if (raw.length === 3) {
        parsed.valid = true;
        parsed.user = raw[1];
        parsed.value = raw[2];
      }
      break;
  }

  // if none of the above cases are true, parsed.valid will stay false

  return parsed;
}

app.command(slashCommand, async ({ command, ack, respond }) => {
  await ack();
  const userCommand = parseCommand(command);

  switch (userCommand.command) {
    case "help":
      helpResponse = await respondToHelp({ user: command.user_id });
      await respond(helpResponse);
      break;
    case "thunderfury":
      thunderfuryResponse = await respondToEasterEgg({ user: command.user_id });
      await respond(thunderfuryResponse);
      break;
    case "balance":
      balanceResponse = await respondToBalance({ user: command.user_id, client: app.client });
      await respond(balanceResponse);
      break;
    case "deduct":
      if (
        userCommand.user === "" ||
        userCommand.value === "" ||
        userCommand.length < 3
      ) {
        await respond(
          "Invalid command. Please use the format `/gratibot deduct [@USER] [VALUE]`."
        );
        break;
      }
      if (!usersDeduction.includes(command.user_id)) {
        await respond("The `deduct` command is not available to you.");
        break;
      }
      if (userCommand.valid) {
        await respond(
          `Deducting ${userCommand.value} from ${userCommand.user}`
        );
        await createDeduction(userCommand.user, userCommand.value);
        break;
      }
  }
});

(async () => {
  await app.start(3000);
  webserver.listen(process.env.PORT || 3000);

  winston.info("⚡️ Bolt app is running!");
})();
