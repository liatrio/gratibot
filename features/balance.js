const balance = require("../service/balance");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "balance",
    anyOf(directMention(), directMessage()),
    balance.respondToBalance
  );
};
