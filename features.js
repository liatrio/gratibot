const config = require("./config");
const balance = require("./service/balance");
const deduction = require("./service/deduction");
const help = require("./service/help");
const join = require("./service/join");
const leaderboard = require("./service/leaderboard");
const metrics = require("./service/metrics");
const recognition = require("./service/recognition");
const redeem = require("./service/redeem");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf, reactionMatches } = require("./middleware");

const { goldenRecognizeEmoji, reactionEmoji, recognizeEmoji } = config;

module.exports = function (app) {
  // Balance
  app.message(
    "balance",
    anyOf(directMention(), directMessage()),
    balance.respondToBalance
  );

  // Deduction
  app.message(
    "deduct",
    anyOf(directMention(), directMessage()),
    deduction.respondToDeduction
  );

  // Golden Recognition
  app.message(
    goldenRecognizeEmoji,
    recognition.respondToGoldenRecognitionMessage
  );

  // Help
  app.message(
    "help",
    anyOf(directMention(), directMessage()),
    help.respondToHelp
  );

  // Easter Eggs
  app.message(/(thunderfury|Thunderfury)/, help.respondToEasterEgg);

  // Auto Join
  app.event("channel_created", join.joinPublicChannel);

  // Leaderboard
  app.message(
    "leaderboard",
    anyOf(directMessage(), directMention()),
    leaderboard.respondToLeaderboard
  );
  app.action(/leaderboard-\d+/, leaderboard.updateLeaderboardResponse);

  // Metrics
  app.message(
    "metrics",
    anyOf(directMessage(), directMention()),
    metrics.respondToMetrics
  );
  app.action(/metrics-\d+/, metrics.updateMetricsResponse);

  // Recognition
  app.message(recognizeEmoji, recognition.respondToRecognitionMessage);
  app.event(
    "reaction_added",
    reactionMatches(reactionEmoji),
    recognition.respondToRecognitionReaction
  );

  // Redeem
  app.message(
    "redeem",
    anyOf(directMention(), directMessage()),
    redeem.respondToRedeem
  );
  app.action({ action_id: "redeem" }, redeem.redeemItem);

  // Refund
  app.message(
    "refund",
    anyOf(directMention(), directMessage()),
    deduction.respondToRefund
  );
};
