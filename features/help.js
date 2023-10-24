const help = require("../service/help");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");

module.exports = function (app) {
  app.message("help", anyOf(directMention(), directMessage()), help.respondToHelp);
  app.message(/(thunderfury|Thunderfury)/, help.respondToEasterEgg);
};
