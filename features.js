const config = require("./config");
const balance = require("./service/balance");
const deduction = require("./service/deduction");
const help = require("./service/help");
const join = require("./service/join");
const leaderboard = require("./service/leaderboard");
const metrics = require("./service/metrics");
const recognition = require("./service/recognition");
const redeem = require("./service/redeem");
const {
  respondToGoldenRecognitionMessage,
} = require("./service/golden-recognition");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf, reactionMatches } = require("./middleware");

const { goldenRecognizeEmoji, reactionEmoji, recognizeEmoji } = config;

function appMessage(app, message, ...func) {
  app.message(message, anyOf(directMention(), directMessage()), ...func);
}

module.exports = function (app) {
  // Balance
  appMessage(app, "balance", balance.respondToBalance);

  // Deduction
  appMessage(app, "deduct", deduction.respondToDeduction);

  // Golden Recognition
  appMessage(app, goldenRecognizeEmoji, respondToGoldenRecognitionMessage);

  // Help
  appMessage(app, "help", help.respondToHelp);

  // Easter Eggs
  appMessage(app, /(thunderfury|Thunderfury)/, help.respondToEasterEgg);

  // Auto Join
  app.event("channel_created", join.joinPublicChannel);

  // Leaderboard
  appMessage(app, "leaderboard", leaderboard.respondToLeaderboard);
  app.action(/leaderboard-\d+/, leaderboard.updateLeaderboardResponse);

  // Metrics
  appMessage(app, "metrics", metrics.respondToMetrics);
  app.action(/metrics-\d+/, metrics.updateMetricsResponse);

  // Recognition
  appMessage(app, recognizeEmoji, recognition.respondToRecognitionMessage);
  app.event(
    "reaction_added",
    reactionMatches(reactionEmoji),
    recognition.respondToRecognitionReaction
  );

  // Redeem
  appMessage(app, "redeem", redeem.respondToRedeem);
  app.action({ action_id: "redeem" }, redeem.redeemItem);

  // Refund
  appMessage(app, "refund", deduction.respondToRefund);
};
