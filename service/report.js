// Reaches out to the Mongo DB database to get the top ten messages for a specified user  
const winston = require("../winston");
const moment = require("moment-timezone");
const recognitionCollection = require("../database/recognitionCollection");
const config = require("../config");


/**
 * Gets the top ten most recognized messages for a specified user within a time range
 * @param {string} userId - The Slack user ID to get messages for
 * @param {number} timeRange - Number of days to look back (default: 30)
 * @param {string} timezone - Timezone to use for date calculations (default: "America/Los_Angeles")
 * @returns {Promise<Array>} - Array of objects containing message info and count
 */
async function getTopMessagesForUser(userId, timeRange = 30, timezone = "America/Los_Angeles") {
  winston.debug("Getting top messages for user", {
    func: "service.report.getTopMessagesForUser",
    userId,
    timeRange,
    timezone,
  });

  // Calculate the date range
  const userDate = moment(Date.now()).tz(timezone);
  const startDate = userDate.clone().subtract(timeRange - 1, "days").startOf("day");

  // Create the filter for the date range and user
  const filter = {
    recognizee: userId,
    timestamp: {
      $gte: new Date(startDate),
    },
  };

  try {
    // Get top 10 messages for this user using MongoDB aggregation
    const topMessages = await recognitionCollection.aggregate([
      // Match only recognitions for this user in the time period
      { $match: filter },
      // Group by message and count occurrences
      { $group: {
          _id: "$message",
          count: { $sum: 1 },
          // Keep the first timestamp for reference
          firstTimestamp: { $first: "$timestamp" },
          // Keep a sample channel for reference
          channel: { $first: "$channel" },
          // Collect all recognizers who gave this recognition
          recognizers: { $addToSet: "$recognizer" }
        }
      },
      // Sort by count in descending order
      { $sort: { count: -1 } },
      // Limit to top 10
      { $limit: 10 }
    ]);
    
    // Format the results
    return topMessages.map(msg => {
      return {
        message: msg._id,
        count: msg.count,
        timestamp: msg.firstTimestamp,
        formattedDate: moment(msg.firstTimestamp).format('MMM D, YYYY'),
        channel: msg.channel,
        recognizers: msg.recognizers
      };
    });
  } catch (error) {
    winston.error("Error getting top messages for user", {
      func: "service.report.getTopMessagesForUser",
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Gets the total count of recognitions received by a user within a time range
 * @param {string} userId - The Slack user ID to get count for
 * @param {number} timeRange - Number of days to look back (default: 30)
 * @param {string} timezone - Timezone to use for date calculations (default: "America/Los_Angeles")
 * @returns {Promise<number>} - Total count of recognitions
 */
async function getTotalRecognitionsForUser(userId, timeRange = 30, timezone = "America/Los_Angeles") {
  // Calculate the date range
  const userDate = moment(Date.now()).tz(timezone);
  const startDate = userDate.clone().subtract(timeRange - 1, "days").startOf("day");

  // Create the filter for the date range and user
  const filter = {
    recognizee: userId,
    timestamp: {
      $gte: new Date(startDate),
    },
  };

  try {
    return await recognitionCollection.count(filter);
  } catch (error) {
    winston.error("Error getting total recognitions for user", {
      func: "service.report.getTotalRecognitionsForUser",
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Creates Block Kit blocks for displaying top messages for a user
 * @param {string} userId - The Slack user ID the report is for
 * @param {Array} topMessages - Data from getTopMessagesForUser
 * @param {number} totalRecognitions - Total recognitions from getTotalRecognitionsForUser
 * @param {number} timeRange - Number of days included in the report
 * @returns {Array} - Block Kit blocks for Slack message
 */
async function createUserTopMessagesBlocks(userId, topMessages, totalRecognitions, timeRange) {
  const blocks = [];
  
  // Add header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${config.recognizeEmoji} Report ${config.recognizeEmoji}`,
      emoji: true
    }
  });
  
  // Add user info
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<@${userId}>* has received *${totalRecognitions}* ${config.recognizeEmoji} in the last *${timeRange} days.*`
    }
  });
  
  // Add divider
  blocks.push({
    type: "divider"
  });
  
  // If no data, show a message
  if (topMessages.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No ${config.recognizeEmoji} found in the specified time period."
      }
    });
  } else {
    // Add top messages section
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Top Messages:*"
      }
    });
    
    // Add each message with its count
    topMessages.forEach((msg, index) => {
      const recognizersText = msg.recognizers.length > 3 
        ? `from <@${msg.recognizers[0]}> and ${msg.recognizers.length - 1} others`
        : `from ${msg.recognizers.map(r => `<@${r}>`).join(', ')}`;
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${index + 1}. *${msg.formattedDate}*: _"${msg.message}"_ (${msg.count} ${config.recognizeEmoji} ${recognizersText})`
        }
      });
    });
  }
  
  // Add time range buttons
  blocks.push({
    type: "actions",
    block_id: "userTopMessagesTimeRange",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Month"
        },
        value: `${userId}:30`,
        action_id: "user-top-messages-30"
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "6 Months"
        },
        value: `${userId}:180`,
        action_id: "user-top-messages-180"
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Year"
        },
        value: `${userId}:365`,
        action_id: "user-top-messages-365"
      }
    ]
  });
  
  return blocks;
}

module.exports = {
  getTopMessagesForUser,
  getTotalRecognitionsForUser,
  createUserTopMessagesBlocks
};
