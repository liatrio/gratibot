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
config.shareChannel = process.env.SHARE_CHANNEL || "C056G7J4B45";
config.shareConfirmReaction = process.env.SHARE_CONFIRM_REACTION || "white_check_mark";
config.maximum = process.env.GRATIBOT_LIMIT || 5;
config.minimumMessageLength = 20;
config.botName = process.env.BOT_NAME || "gratibot";
config.slashCommand = process.env.SLASH_COMMAND || "/gratibot";

config.usersExemptFromMaximum = process.env.EXEMPT_USERS?.split(",") || [
  "U037FL37G", // Chris Blackburn
  "U8T585Y8J", // Jeremy Hayes
  "U04KTAJRS5T", // Mike Denton
  "U0K32MUSF", // Robert Kelly
  "U05HA77CE5S", //Ryan McClish
];

config.initialGoldenRecognitionHolder =
  process.env.GOLDEN_RECOGNIZE_HOLDER || "UE1QRFSSY";
config.redemptionAdmins = process.env.REDEMPTION_ADMINS?.split(",") || [
  "U04666K57CP", // Danielle Johnson
];

module.exports = config;
