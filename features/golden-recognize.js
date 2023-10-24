const config = require("../config");
const recognition = require("../service/golden-recognition");

const { goldenRecognizeEmoji } = config;

module.exports = function (app) {
  app.message(
    goldenRecognizeEmoji,
    recognition.respondToGoldenRecognitionMessage
  );
};
