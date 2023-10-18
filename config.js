var config = {};
var _ = require("lodash");

config.mongo_url = process.env.MONGO_URL || "mongodb://mongodb:27017/gratibot";

config.logLevel = process.env.LOG_LEVEL || "info";

config.recognizeEmoji =
  _.escapeRegExp(process.env.RECOGNIZE_EMOJI) || ":fistbump:";
config.goldenRecognizeEmoji =
  process.env.GOLDEN_RECOGNIZE_EMOJI || ":goldenfistbump:";
config.goldenRecognizeChannel =
  process.env.GOLDEN_RECOGNIZE_CHANNEL || "liatrio";
config.reactionEmoji = process.env.REACTION_EMOJI || ":nail_care:";
console.warn(`env variable of $GRATIBOT_LIMIT is equal to: ${process.env.GRATIBOT_LIMIT}`);
config.maximum = process.env.GRATIBOT_LIMIT || 5;
config.minimumMessageLength = 20;
config.botName = process.env.BOT_NAME || "gratibot";
console.warn(`env variable of SLASH_COMMAND equal to: ${process.env.SLASH_COMMAND}`);
config.slashCommand = process.env.SLASH_COMMAND || "/gratibot";

config.usersExemptFromMaximum = process.env.EXEMPT_USERS?.split(",") || [
  "U037FL37G",
  "U8T585Y8J",
  "U04KTAJRS5T",
  "U0K32MUSF",
];

config.initialGoldenRecognitionHolder =
  process.env.GOLDEN_RECOGNIZE_HOLDER || "UE1QRFSSY";
config.redemptionAdmins = process.env.REDEMPTION_ADMINS?.split(",") || [
  "U6BS54PJM",
  "U02KPMFA9DG",
  "U04666K57CP",
];

config.usersDeduction = process.env.USERS_DEDUCTION?.split(",") || [
  "U04666K57CP", // Danielle
  "U8T585Y8J", // Jeremy
  "U02KPMFA9DG", // Smith
];

module.exports = config;


/*     


const app = new App({ // Create instance of the slack bot
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.APP_TOKEN,
  socketMode: true
  // logLevel: LogLevel.DEBUG
});

let slashCommand = '/groupybot';

if (process.env.DEV === '1') {
  logger.info('Using dev slash command.');
  slashCommand = '/groupybot-dev';
}

app.command(slashCommand, async ({ command, body, ack, respond }) => {

  await ack();
  const userCommand = parseCommand(command); // breaks user command into an object with the attributes valid, command, users, and group

  switch (userCommand.command) {
      case 'deduct':
      if (userCommand.valid) {

        // do some stoof

      } else {
        logger.info('Invalid command.');
        await respond('Not a valid add command, usage: [ deduct @user1 num ]');
      }
      break;
    }
});

*/

// /gratibot deduct @user1 50