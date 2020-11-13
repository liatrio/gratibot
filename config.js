var config = {};

config.mongo_url = process.env.MONGO_URL || 'mongodb://mongodb:27017/gratibot';

config.logLevel = process.env.LOG_LEVEL || 'info';

config.emoji = process.env.EMOJI || ':fistbump:';
config.reactionEmoji = 'nail_care'
config.maximum = 5;
config.minimumMessageLength = 20;

config.usersExemptFromMaximum = [
  'U037FL37G',
];

module.exports = config;
