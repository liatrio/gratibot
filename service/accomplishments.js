const winston = require("../winston");
const recognition = require("./recognition");
const moment = require("moment-timezone");

/**
 * Creates blocks for displaying a user's accomplishments (recognitions received)
 * @param {string} userId The ID of the user to get accomplishments for
 * @param {number} days Number of days to look back for accomplishments
 * @returns {Array} Array of Slack Block Kit blocks
 */
async function createAccomplishmentsBlocks(userId, days = 30) {
  const timezone = "America/Los_Angeles"; // Default timezone
  const recognitions = await recognition.getUserReceivedRecognitions(userId, timezone, days);
  
  winston.debug(`Creating accomplishments blocks for user ${userId}`, {
    func: "service.accomplishments.createAccomplishmentsBlocks",
    userId: userId,
    days: days,
    recognitionsCount: recognitions.length,
  });

  let blocks = [];
  
  // Header block
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Your Accomplishments (Last ${days} Days)`,
      emoji: true,
    },
  });

  // If no recognitions, show a message
  if (recognitions.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "You haven't received any recognitions in the past " + days + " days. Keep up the good work and you'll get recognized soon!",
      },
    });
    return blocks;
  }

  // Summary block
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `You've received *${recognitions.length}* recognition${recognitions.length !== 1 ? 's' : ''} in the past ${days} days!`,
    },
  });

  // Divider
  blocks.push({ type: "divider" });

  // Group recognitions by message
  const groupedRecognitions = groupRecognitionsByMessage(recognitions);
  
  // Create blocks for grouped recognitions
  const recognitionBlocks = createGroupedRecognitionBlocks(groupedRecognitions);
  blocks = blocks.concat(recognitionBlocks);
  
  // Add note if we're not showing all unique messages
  if (groupedRecognitions.length > 10) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Showing top 10 of ${groupedRecognitions.length} unique recognition messages. Slack has a limit on how many can be displayed._`,
        },
      ],
    });
  }

  // Time range info
  blocks.push({
    type: "context",
    elements: [
      {
        type: "plain_text",
        text: `Showing recognitions from the last ${days} days`,
        emoji: true,
      },
    ],
  });

  // Time range buttons
  blocks.push(timeRangeButtons());

  // Ensure we don't exceed Slack's block limit (50 blocks max)
  if (blocks.length > 49) {
    // If we have too many blocks, truncate and add a warning
    blocks = blocks.slice(0, 48);
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Some content couldn't be displayed due to Slack message limits._",
        },
      ],
    });
  }

  return blocks;
}

/**
 * Groups recognitions by message and counts occurrences
 * @param {Array} recognitions Array of recognition objects
 * @returns {Array} Array of grouped recognition objects with counts, sorted by count (descending)
 */
function groupRecognitionsByMessage(recognitions) {
  // Create a map to group recognitions by message
  const messageGroups = new Map();
  
  recognitions.forEach(rec => {
    const message = rec.message.trim();
    
    if (!messageGroups.has(message)) {
      messageGroups.set(message, {
        message: message,
        count: 0,
        recognizers: new Set(),
        firstTimestamp: null,
        lastTimestamp: null,
        instances: []
      });
    }
    
    const group = messageGroups.get(message);
    group.count++;
    group.recognizers.add(rec.recognizer);
    group.instances.push(rec);
    
    // Track first and last timestamps
    const timestamp = new Date(rec.timestamp);
    if (!group.firstTimestamp || timestamp < new Date(group.firstTimestamp)) {
      group.firstTimestamp = rec.timestamp;
    }
    if (!group.lastTimestamp || timestamp > new Date(group.lastTimestamp)) {
      group.lastTimestamp = rec.timestamp;
    }
  });
  
  // Convert map to array and sort by count (descending)
  const groupedArray = Array.from(messageGroups.values());
  groupedArray.sort((a, b) => b.count - a.count);
  
  return groupedArray;
}

/**
 * Creates blocks for grouped recognitions
 * @param {Array} groupedRecognitions Array of grouped recognition objects
 * @returns {Array} Array of Slack Block Kit blocks
 */
function createGroupedRecognitionBlocks(groupedRecognitions) {
  const blocks = [];
  
  // Limit to top 10 most frequent messages
  const limitedGroups = groupedRecognitions.slice(0, 10);

  limitedGroups.forEach((group, index) => {
    // Format the date range
    const firstDate = moment(group.firstTimestamp).format("MMM D");
    const lastDate = moment(group.lastTimestamp).format("MMM D, YYYY");
    const dateRange = firstDate === lastDate ? lastDate : `${firstDate} - ${lastDate}`;
    
    // Format recognizers
    const recognizersList = Array.from(group.recognizers)
      .map(id => `<@${id}>`)
      .join(", ");
    
    // Truncate message if it's too long
    const maxMessageLength = 200;
    let message = group.message;
    if (message.length > maxMessageLength) {
      message = message.substring(0, maxMessageLength) + "...";
    }
    
    // Create section block with message and count
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${index + 1}. Recognized ${group.count} time${group.count !== 1 ? 's' : ''}* (${dateRange})\n>${message}\n_From: ${recognizersList}_`,
      },
    });

    // Add divider between groups (except after the last one)
    if (index < limitedGroups.length - 1) {
      blocks.push({ type: "divider" });
    }
  });

  return blocks;
}

/**
 * Creates buttons for different time ranges
 * @returns {Object} A Block Kit action block with time range buttons
 */
function timeRangeButtons() {
  return {
    type: "actions",
    block_id: "accomplishmentsButtons",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "7 Days",
        },
        value: "7",
        action_id: "accomplishments-7",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "30 Days",
        },
        value: "30",
        action_id: "accomplishments-30",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "90 Days",
        },
        value: "90",
        action_id: "accomplishments-90",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "All Time",
        },
        value: "3650",
        action_id: "accomplishments-3650",
      },
    ],
  };
}

module.exports = {
  createAccomplishmentsBlocks,
};
