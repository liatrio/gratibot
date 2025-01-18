const config = require("../config");
const recognition = require("../service/recognition");
const winston = require("../winston");
const { SlackError, GratitudeError } = require("../service/errors");
const { userInfo } = require("../service/apiwrappers");
const shareReactionCollection = require("../database/shareReactionCollection");
const {
  handleSlackError,
  handleGratitudeError,
  handleGenericError,
  sendNotificationToReceivers,
} = require("../service/messageutils");

const { recognizeEmoji, shareChannel, shareConfirmReaction } = config;

module.exports = function (app) {
  app.message(recognizeEmoji, respondToRecognitionMessage);
  app.event("reaction_added", async ({ event, client }) => {
    winston.debug("Received reaction event", {
      event: JSON.stringify(event),
      channel: event.item.channel,
    });

    // Handle share confirmation reactions in the share-me-please channel
    if (
      event.item.channel === shareChannel &&
      event.reaction === shareConfirmReaction
    ) {
      await handleShareConfirmation({ event, client });
      return;
    }
    // Handle regular recognition reactions
    if (event.reaction === config.reactionEmoji.slice(1, -1)) {
      await respondToRecognitionReaction({ event, client });
    }
  });
};

async function respondToRecognitionMessage({ message, client }) {
  winston.info(`Heard reference to ${recognizeEmoji}`, {
    func: "features.recognize.respondToRecognitionMessage",
    callingUser: message.user,
    slackMessage: message.text,
  });

  let allUsers = [];
  let gratitude;
  try {
    allUsers = await recognition.gratitudeReceiverIdsIn(client, message.text);
    gratitude = {
      giver: await userInfo(client, message.user),
      receivers: await Promise.all(
        allUsers.map(async (id) => userInfo(client, id)),
      ),
      count: recognition.gratitudeCountIn(message.text),
      message: message.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(message.text),
      channel: message.channel,
      tags: recognition.gratitudeTagsIn(message.text),
      type: recognizeEmoji,
      giver_in_receivers: false,
    };

    // Check if the user who reacted is also a receiver
    if (gratitude.receivers.some((r) => r.id === gratitude.giver.id)) {
      gratitude.giver_in_receivers = true;
    }

    await recognition.validateAndSendGratitude(gratitude);

    winston.debug(
      `validated and stored message recognitions from ${gratitude.giver}`,
      {
        func: "features.recognize.respondToRecognitionMessage",
        callingUser: message.user,
        slackMessage: message.text,
      },
    );
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(client, message, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(client, message, e);
    } else {
      return handleGenericError(client, message, e);
    }
  }

  return Promise.all([
    sendNotificationToReceivers(client, gratitude),
    client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `${recognizeEmoji} has been sent.`,
      ...(await recognition.giverSlackNotification(gratitude)),
    }),
    client.reactions.add({
      channel: message.channel,
      name: config.reactionEmoji.slice(1, -1),
      timestamp: message.ts,
    }),
  ]);
}

/**
 * Retrieves message details from Slack
 * @param {Object} client - Slack client instance
 * @param {Object} message - Message details containing channel and timestamp
 * @returns {Promise<Object>} The message details from Slack
 * @throws {SlackError} If the API call fails
 */
async function messageReactedTo(client, message) {
  try {
    const response = await client.conversations.replies({
      channel: message.channel,
      ts: message.ts,
      limit: 1,
    });

    if (!response.ok) {
      throw new SlackError(
        "conversations.replies",
        response.error,
        `Failed to retrieve message information: ${response.error}`,
      );
    }

    return response.messages[0];
  } catch (error) {
    winston.error("Error retrieving message details", {
      error: error.message,
      channel: message.channel,
      ts: message.ts,
    });
    throw error;
  }
}

/**
 * Creates a gratitude object for share confirmation
 * @param {Object} params - Parameters for creating gratitude
 * @param {Object} params.user - User information from Slack
 * @param {string} params.channel - Channel ID
 * @param {string} params.messageTs - Original message timestamp
 * @param {string} params.timezone - User's timezone
 * @returns {Object} Gratitude object
 */
function createShareGratitude({ user, channel, messageTs, timezone }) {
  return {
    giver: {
      id: "GRATIBOT",
      real_name: "Gratibot",
      username: "gratibot",
      tz: timezone,
    },
    receivers: [
      {
        id: user.id,
        real_name: user.real_name,
        username: user.name,
        tz: timezone,
      },
    ],
    count: 1,
    message: `Thank you for sharing this with your network! Here's a ${recognizeEmoji} for helping spread the word!`,
    trimmedMessage: "Reward for sharing content",
    channel,
    tags: ["share-confirmation"],
    type: recognizeEmoji,
    giver_in_receivers: false,
    metadata: {
      originalMessageTs: messageTs,
    },
  };
}

/**
 * Handles share confirmation reactions
 * @param {Object} params - Event parameters from Slack
 * @param {Object} params.event - Reaction event details
 * @param {Object} params.client - Slack client instance
 */
async function handleShareConfirmation({ event, client }) {
  try {
    // Get user info and timezone
    const userInfo = await client.users.info({ user: event.user });
    if (!userInfo.ok) {
      throw new SlackError(
        "users.info",
        userInfo.error,
        "Failed to retrieve user information",
      );
    }

    // Check for existing reaction
    const existingReaction = await shareReactionCollection.findOne({
      messageTs: event.item.ts,
      userId: event.user,
    });

    if (existingReaction) {
      return client.chat.postEphemeral({
        channel: event.item.channel,
        user: event.user,
        text: "You've already confirmed sharing this post. Thank you for your engagement! 🙌",
      });
    }

    // Verify the original message exists
    await messageReactedTo(client, {
      channel: event.item.channel,
      ts: event.item.ts,
    });

    // Record the share reaction
    await shareReactionCollection.insert({
      messageTs: event.item.ts,
      userId: event.user,
      channel: event.item.channel,
      timestamp: new Date(),
    });

    // Create and validate gratitude
    const gratitude = createShareGratitude({
      user: userInfo.user,
      channel: event.item.channel,
      messageTs: event.item.ts,
      timezone: userInfo.user.tz,
    });

    await recognition.validateAndSendGratitude(gratitude);

    // Notify the user
    await client.chat.postEphemeral({
      channel: event.item.channel,
      user: event.user,
      text: `Thank you for sharing! You've received a ${recognizeEmoji} as a reward for your contribution! 🎉`,
    });

    winston.debug("Share confirmation processed", {
      func: "handleShareConfirmation",
      user: userInfo.user.real_name,
      messageTs: event.item.ts,
      channel: event.item.channel,
    });
  } catch (e) {
    winston.error("Share confirmation failed", {
      error: e.message,
      stack: e.stack,
      event,
    });

    const errorMessage = {
      channel: event.item.channel,
      user: event.user,
    };

    if (e instanceof SlackError) {
      return handleSlackError(client, errorMessage, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(client, errorMessage, e);
    }
    return handleGenericError(client, errorMessage, e);
  }
}

async function respondToRecognitionReaction({ event, client }) {
  winston.info(`Saw a reaction containing ${config.reactionEmoji}`, {
    func: "features.recognize.respondToRecognitionReaction",
    callingUser: event.user,
    reactionEmoji: event.reaction,
  });

  event.channel = event.item.channel;

  let allUsers = [];
  let gratitude;
  let originalMessage;
  try {
    originalMessage = await messageReactedTo(client, {
      channel: event.channel,
      ts: event.ts,
    });

    if (!originalMessage.text.includes(recognizeEmoji)) {
      return;
    }

    allUsers = await recognition.gratitudeReceiverIdsIn(
      client,
      originalMessage.text,
    );
    gratitude = {
      giver: await userInfo(client, event.user),
      receivers: await Promise.all(
        allUsers.map(async (id) => userInfo(client, id)),
      ),
      count: 1,
      message: originalMessage.text,
      trimmedMessage: recognition.trimmedGratitudeMessage(originalMessage.text),
      channel: event.channel,
      tags: recognition.gratitudeTagsIn(originalMessage.text),
      type: recognizeEmoji,
      giver_in_receivers: false,
    };

    // Check if the user who reacted is also a receiver
    if (gratitude.receivers.some((r) => r.id === gratitude.giver.id)) {
      gratitude.giver_in_receivers = true;
    }

    await recognition.validateAndSendGratitude(gratitude);

    winston.debug(
      `validated and stored reaction recognitions from ${gratitude.giver}`,
      {
        func: "features.recognize.respondToRecognitionReaction",
        callingUser: event.user,
        slackMessage: event.reactions,
      },
    );
  } catch (e) {
    if (e instanceof SlackError) {
      return handleSlackError(client, event, e);
    } else if (e instanceof GratitudeError) {
      return handleGratitudeError(client, event, e);
    } else {
      return handleGenericError(client, event, e);
    }
  }

  return Promise.all([
    sendNotificationToReceivers(client, gratitude),
    client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: `${recognizeEmoji} has been sent.`,
      ...(await recognition.giverSlackNotification(gratitude)),
    }),
  ]);
}
