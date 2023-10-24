const leaderboard = require("../service/leaderboard");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "leaderboard",
    anyOf(directMessage(), directMention()),
    leaderboard.respondToLeaderboard
  );
  app.action(/leaderboard-\d+/, leaderboard.updateLeaderboardResponse);
};
