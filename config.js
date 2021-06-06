var config = {};

config.mongo_url = process.env.MONGO_URL || "mongodb://mongodb:27017/gratibot";

config.logLevel = process.env.LOG_LEVEL || "info";

config.recognizeEmoji = process.env.RECOGNIZE_EMOJI || ":fistbump:";
config.reactionEmoji = process.env.REACTION_EMOJI || ":nail_care:";
config.maximum = 5;
config.minimumMessageLength = 20;
config.botName = process.env.BOT_NAME || "gratibot";

config.usersExemptFromMaximum = process.env.EXEMPT_USERS?.split(",") || ["U037FL37G"];

module.exports = config;
