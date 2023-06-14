const { SlackError } = require("../service/errors");
const {
  handleSlackError,
  handleGenericError,
} = require("../service/messageutils");

module.exports = function (app) {
  app.event("channel_created", joinPublicChannel);
};

async function joinPublicChannel({ event, client }) {
  try {
    client.conversations.join({ channel: event.channel.id });
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(client, event, e);
    } else {
      return handleGenericError(client, event, e);
    }
  }
}
