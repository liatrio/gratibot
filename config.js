var config = {};
var _ = require("lodash");

config.mongo_url = process.env.MONGO_URL || "mongodb://mongodb:27017/gratibot";

config.logLevel = process.env.LOG_LEVEL || "info";

config.recognizeEmoji =
  _.escapeRegExp(process.env.RECOGNIZE_EMOJI) || ":fistbump:";
config.goldenRecognizeEmoji =
  process.env.GOLDEN_RECOGNIZE_EMOJI || ":goldenfistbump:";
config.selfRecognizeEmoji =
  _.escapeRegExp(process.env.SELF_RECOGNIZE_EMOJI) || ":self-fistbump:";
config.goldenRecognizeChannel =
  process.env.GOLDEN_RECOGNIZE_CHANNEL || "liatrio";
config.reactionEmoji = process.env.REACTION_EMOJI || ":nail_care:";
config.maximum = process.env.GRATIBOT_LIMIT || 5;
config.selfRecognitionMaximum = 1;
config.minimumMessageLength = 20;
config.botName = process.env.BOT_NAME || "gratibot";
config.slashCommand = process.env.SLASH_COMMAND || "/gratibot";

config.usersExemptFromMaximum = process.env.EXEMPT_USERS?.split(",") || [
  "U037FL37G", // Chris Blackburn
  "U8T585Y8J", // Jeremy Hayes
  "U04KTAJRS5T", // Mike Denton
  "U0K32MUSF", // Robert Kelly
  "U05HA77CE5S", // Ryan McClish
  "U08PEV0SCLW", // Avery Green
  "U04ALSRL5S7", // Andrew Barefield
  "U04MY32BRC5", // Dave Collins
  "U068XJMNYPR", // Mike Morain
  "U9N4VK0HM", // Bjorn Edwin
  "U0B4BG2KZ7S", // Casey Lee
];

config.initialGoldenRecognitionHolder =
  process.env.GOLDEN_RECOGNIZE_HOLDER || "UE1QRFSSY";
config.redemptionAdmins = process.env.REDEMPTION_ADMINS?.split(",") || [
  "U04666K57CP", // Danielle Johnson
];

const stadiumMaximumFistbumps = process.env.STADIUM_MAX_FISTBUMPS?.trim();

config.stadium = {
  enabled: process.env.STADIUM_ENABLED === "true",
  emailSource: process.env.STADIUM_EMAIL_SOURCE || "modal",
  apiBaseUrl:
    process.env.STADIUM_API_BASE_URL ||
    "https://api.preprod.bystadium.com/api/v2",
  clientId: process.env.STADIUM_CLIENT_ID,
  clientSecret: process.env.STADIUM_CLIENT_SECRET,
  storeNumber: process.env.STADIUM_STORE_NUMBER,
  storeUrl: process.env.STADIUM_STORE_URL,
  paymentMethod: process.env.STADIUM_PAYMENT_METHOD,
  billingCountry: process.env.STADIUM_BILLING_COUNTRY,
  billingZipcode: process.env.STADIUM_BILLING_ZIPCODE,
  fistbumpsPerUnit: Number(process.env.STADIUM_FISTBUMPS_PER_UNIT || 1),
  pointsPerUnit: Number(process.env.STADIUM_POINTS_PER_UNIT || 1),
  minimumFistbumps: Number(process.env.STADIUM_MIN_FISTBUMPS || 1),
  maximumFistbumps: stadiumMaximumFistbumps
    ? Number(stadiumMaximumFistbumps)
    : null,
};

module.exports = config;
