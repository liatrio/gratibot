const { SlackError } = require("./errors");
const { handleSlackError, handleGenericError } = require("./messageutils");

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

module.exports = {
  joinPublicChannel,
};
