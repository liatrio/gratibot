const { SlackError } = require("./errors");
const winston = require("../winston");

async function userInfo(client, userId) {
  const response = await client.users.info({ user: userId });
  if (response.ok) {
    return response.user;
  }

  throw new SlackError(
    "users.info",
    response.error,
    `Something went wrong while sending recognition. When retreiving user information from Slack, the API responded with the following error: ${response.message} \n Recognition has not been sent.`
  );
}

function winstonInfo(info, func, message) {
  if (message.user.id) {
    message.user = message.user.id;
  }
  winston.info(info, {
    func: func,
    callingUser: message.user,
    slackMessage: message.text,
    reactionEmoji: message.reaction,
  });
}

function winstonDebug(info, func, message) {
  if (message.reactions) {
    message.text = message.reactions;
  }
  winston.debug(info, {
    func: func,
    callingUser: message.user,
    slackMessage: message.text,
    reactionEmoji: message.reaction,
  });
}

function winstonError(info, func, message, userInfo) {
  winston.error(info, {
    func: func,
    callingUser: message.user,
    slackMessage: message.text,
    error: userInfo.error,
  });
}

module.exports = {
  userInfo,
  winstonInfo,
  winstonDebug,
  winstonError,
};
