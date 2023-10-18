const { App } = require("@slack/bolt");
const express = require("express");
const webserver = express();
const winston = require("./winston");
const {
  recognizeEmoji,
  maximum,
  reactionEmoji,
  goldenRecognizeEmoji,
  slashCommand
} = require("./config");

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

/// ////////////////////////////////////////////////////////////
// Slash Command Logic //
/// ////////////////////////////////////////////////////////////

app.command(slashCommand, async ({ command, ack, respond }) => {

  await ack();
  const userCommand = parseCommand(command);

  switch (userCommand.command) {
    case 'help':
      await respond(helpMarkdown);
  }

});

(async () => {
  await app.start(3000);
  webserver.listen(process.env.PORT || 3000);

  winston.info("⚡️ Bolt app is running!");
})();

/// ////////////////////////////////////////////////////////////
// Functions //
/// ////////////////////////////////////////////////////////////

// Parse Command Function
function parseCommand (command) {
  const parsed = { // Default values for each parameter
    valid: false, // indicates if a command is valid
    command: '', // holds the type of command
    user: '', // holds the value for the user that will be targeted
  };

  const raw = command.text.split(' '); // raw command as an array
  parsed.command = raw[0];

  switch (raw[0]) {
    case 'help':
      parsed.valid = true; // command is valid, but doesn't require any additional info
      break;
  }

  // if none of the above cases are true, parsed.valid will stay false

  return parsed;
}

/// ////////////////////////////////////////////////////////////
// Variables //
/// ////////////////////////////////////////////////////////////

// Text is rendered into help command
const helpMarkdown = `
:wave: Hi there! Let's take a look at what I can do!




*Give Recognition*

You can give up to ${maximum} recognitions per day.

First, make sure I have been invited to the channel you want to recognize \
someone in. Then, write a brief message describing what someone did, \
\`@mention\` them and include the ${recognizeEmoji} emoji...I'll take it from there!

> Thanks @alice for helping me fix my pom.xml ${recognizeEmoji}

Recognize multiple people at once!

> @bob and @alice crushed that showcase! ${recognizeEmoji}

Use \`#tags\` to call out specific Liatrio values!

> I love the #energy in your Terraform demo @alice! ${recognizeEmoji}

The more emojis you add, the more recognition they get!

> @alice just pushed the cleanest code I've ever seen! ${recognizeEmoji} ${recognizeEmoji} ${recognizeEmoji}

Use multipliers to give more recognition!

> @alice presented an amazing demo at a conference! ${recognizeEmoji} x2

or

> @alice presented an amazing demo at a conference! x2 ${recognizeEmoji}

If someone else has given a ${recognizeEmoji} to someone, and you'd like to \
give one of your own for the same reason, you can react to the message with \
a ${reactionEmoji}. Gratibot will record your shout-out as though you sent \
the same message that you reacted to.

*Redeeming*


Send me a direct message with 'redeem' and I'll give you the options for prizes to redeem! Once you've selcted an item then I'll start a MPIM with the redemption admins to promote the dialog to acknowledge and receive your item.

Refunds can be given via the 'refund' command if the item redeem can't be fulfilled for whatever reason. Only redemption admins can give refunds. Deduction ID is sent as part of the MPIM when an item is redeemed

> @gratibot refund DEDUCTIONID


*View Balance*

Send me a direct message with 'balance' and I'll let you know how many \
recognitions you have left to give and how many you have received.

> You have received 0 ${recognizeEmoji} and you have ${maximum} ${recognizeEmoji} remaining to \
give away today




*View Leaderboard*

Send me a direct message with 'leaderboard' and I'll show you who is giving \
and receiving the most recognition. I'll also show who currently holds the :goldenfistbump:!




*View Metrics*

Send me a direct message with 'metrics' and I'll show you how many times \
people have given recognitions over the last month.


*Give Golden Recognition*

The golden fistbump ${goldenRecognizeEmoji} is a special recognition that can only be held by one user at a time. Only the current holder of the golden recognition can give the golden recognition.

Giving a golden fistbump is the same as giving a normal fistbump

> Thanks @alice for helping fix the prod issues! ${goldenRecognizeEmoji}

Upon receiving the golden fistbump, the user will receive 20 fistbumps and will have a 2X multiplier applied to all incoming fistbumps while the golden fistbump is held.
`;