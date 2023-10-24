const { joinPublicChannel } = require("../service/join");

module.exports = function (app) {
  app.event("channel_created", joinPublicChannel);
};
