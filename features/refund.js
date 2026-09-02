const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const refund = require("../service/refund");

module.exports = function (app) {
  app.message(
    /^(?!.*\bstadium\s+resolve\b.*\brefund\b).*\brefund\b/is,
    anyOf(directMention, directMessage),
    refund.respondToRefund,
  );
};
