const deduction = require("../service/deduction");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  app.message(
    "deduct",
    anyOf(directMention(), directMessage()),
    deduction.respondToDeduction
  );
};
