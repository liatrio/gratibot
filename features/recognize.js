const config = require("../config");
const recognition = require("../service/recognition");
const { reactionMatches } = require("../middleware");

const { recognizeEmoji, reactionEmoji } = config;

module.exports = function (app) {
  app.message(recognizeEmoji, recognition.respondToRecognitionMessage);
  app.event(
    "reaction_added",
    reactionMatches(reactionEmoji),
    recognition.respondToRecognitionReaction
  );
};
