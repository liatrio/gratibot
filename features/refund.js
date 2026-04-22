const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const refund = require("../service/refund");

module.exports = function (app) {
  app.message(
    /refund/i,
    anyOf(directMention, directMessage),
    refund.respondToRefund,
  );
};
