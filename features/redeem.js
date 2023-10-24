const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const redeem = require("../service/redeem");

module.exports = function (app) {
  app.message(
    "redeem",
    anyOf(directMention(), directMessage()),
    redeem.respondToRedeem
  );
  app.action({ action_id: "redeem" }, redeem.redeemItem);
};
