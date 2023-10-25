const metrics = require("../service/metrics");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "metrics",
    anyOf(directMessage(), directMention()),
    metrics.respondToMetrics
  );
  app.action(/metrics-\d+/, metrics.updateMetricsResponse);
};
