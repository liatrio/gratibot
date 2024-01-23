// Refund a redemption. This will delete the deduction of the associated ID
// Ex: @gratibot refund DEDUCTION_ID
// only redemption admins can execute this command
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const refund = require("../service/refund");

module.exports = function (app) {
  app.message(
    "refund",
    anyOf(directMention(), directMessage()),
    refund.respondToRefund,
  );
};
