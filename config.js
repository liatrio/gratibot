var config = {};

config.mongo_url = process.env.MONGO_URL || "mongodb://mongodb:27017/gratibot";

config.logLevel = process.env.LOG_LEVEL || "info";

config.recognizeEmoji = process.env.RECOGNIZE_EMOJI || ":fistbump:";
config.superRecognizeEmoji = process.env.SUPER_RECOGNIZE_EMOJI || ":booom:";
config.reactionEmoji = process.env.REACTION_EMOJI || ":nail_care:";
config.maximum = process.env.GRATIBOT_LIMIT || 5;
config.minimumMessageLength = 20;
config.botName = process.env.BOT_NAME || "gratibot";

config.usersExemptFromMaximum = process.env.EXEMPT_USERS?.split(",") || [
  "U037FL37G",
  "U8T585Y8J",
];

module.exports = config;
