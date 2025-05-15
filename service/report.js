// Reaches out to the Mongo DB database to get the top ten messages for a specified user  
const winston = require("../winston");
const moment = require("moment-timezone");
const recognitionCollection = require("../database/recognitionCollection");


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
      // Replace double spaces in the message with the user ID
      const processedMessage = msg._id.replace(/\s{2,}/g, ` :devious-joe: `);
      
      return {
        message: processedMessage,
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
      text: `:fistbump: Fistbump Report :fistbump:`,
      emoji: true
    }
  });
  
  // Add user info
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<@${userId}>* has received *${totalRecognitions}* :fistbump: in the last *${timeRange} days.*`
    }
  });
  
  // Generate chart and add it to blocks
  try {
    const chartUrl = await createUserRecognitionChart(userId, timeRange);
    blocks.push({
      type: "image",
      title: {
        type: "plain_text",
        text: "Fistbumps Received by Week",
      },
      image_url: chartUrl,
      alt_text: "Chart showing fistbumps received by week",
    });
  } catch (error) {
    winston.error("Error adding chart to report", {
      func: "service.report.createUserTopMessagesBlocks",
      userId,
      error,
    });
    // Continue without the chart if there's an error
  }
  
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
        text: "No :fistbump: found in the specified time period."
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
          text: `${index + 1}. *${msg.formattedDate}*: _"${msg.message}"_ (${msg.count} :fistbump: ${recognizersText})`
        }
      });
    });
  }
  
  // Add time range info
//   blocks.push({
//     type: "context",
//     elements: [
//       {
//         type: "plain_text",
//         text: `Showing data from the last ${timeRange} days`,
//         emoji: true
//       }
//     ]
//   });
  
  // Add time range buttons
//   blocks.push({
//     type: "actions",
//     block_id: "userTopMessagesTimeRange",
//     elements: [
//       {
//         type: "button",
//         text: {
//           type: "plain_text",
//           emoji: true,
//           text: "Week"
//         },
//         value: `${userId}:7`,
//         action_id: "user-top-messages-7"
//       },
//       {
//         type: "button",
//         text: {
//           type: "plain_text",
//           emoji: true,
//           text: "Month"
//         },
//         value: `${userId}:30`,
//         action_id: "user-top-messages-30"
//       },
//       {
//         type: "button",
//         text: {
//           type: "plain_text",
//           emoji: true,
//           text: "Quarter"
//         },
//         value: `${userId}:90`,
//         action_id: "user-top-messages-90"
//       }
//     ]
//   });
  
  return blocks;
}

/**
 * Creates a chart showing fistbumps received by week for a specific user
 * @param {string} userId - The Slack user ID to get data for
 * @param {number} timeRange - Number of days to look back
 * @param {string} timezone - Timezone to use for date calculations
 * @returns {Promise<string>} - URL to the generated chart image
 */
async function createUserRecognitionChart(userId, timeRange, timezone = "America/Los_Angeles") {
  try {
    // Get all recognitions for this user in the time period
    const recognitionData = await getUserRecognitionData(userId, timeRange, timezone);
    
    // Create chart configuration
    const chart = {
      type: "bar",
      data: {
        datasets: [
          {
            label: "Fistbumps",
            data: aggregateDataByWeek(recognitionData, timeRange, timezone),
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          },
        ],
      },
      options: {
        scales: {
          xAxes: [
            {
              type: "time",
              time: {
                unit: "week",
                displayFormats: {
                  week: 'MMM D'
                }
              },
              title: {
                display: true,
                text: "Week"
              }
            },
          ],
          yAxes: [
            {
              title: {
                display: true,
                text: "Count"
              },
              ticks: {
                beginAtZero: true,
                precision: 0
              }
            }
          ]
        },
        plugins: {
          title: {
            display: true,
            text: `Fistbumps Received (Last ${timeRange} Days)`
          }
        }
      },
    };
    
    // Encode chart configuration for URL
    const encodedChart = encodeURIComponent(JSON.stringify(chart));
    return `https://quickchart.io/chart?c=${encodedChart}`;
  } catch (error) {
    winston.error("Error creating user recognition chart", {
      func: "service.report.createUserRecognitionChart",
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Gets all recognition data for a user within a time period
 * @param {string} userId - The user ID to get data for
 * @param {number} timeRange - Number of days to look back
 * @param {string} timezone - Timezone to use for date calculations
 * @returns {Promise<Array>} - Array of recognition documents
 */
async function getUserRecognitionData(userId, timeRange, timezone) {
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
  
  return await recognitionCollection.find(filter);
}

/**
 * Aggregates recognition data by week
 * @param {Array} recognitionData - Array of recognition documents
 * @param {number} timeRange - Number of days to look back
 * @param {string} timezone - Timezone to use for date calculations
 * @returns {Array} - Array of data points for the chart
 */
function aggregateDataByWeek(recognitionData, timeRange, timezone) {
  // Calculate the number of weeks we need to cover
  const numberOfWeeks = Math.ceil(timeRange / 7);
  
  // Create empty data points for each week
  let data = [];
  let currentTime = moment(Date.now()).tz(timezone);
  
  // Start at the beginning of the current week
  let weekStart = currentTime.clone().startOf('week');
  
  // Create data points for each week
  for (let i = 0; i < numberOfWeeks; i++) {
    // For each week, create a data point with the week's start date
    data.push({
      x: weekStart.clone().subtract(i * 7, "days").format("YYYY-MM-DD"),
      y: 0,
    });
  }
  
  // Reverse to get chronological order
  data = data.reverse();
  
  // Count recognitions for each week
  recognitionData.forEach(recognition => {
    const recognitionDate = moment(recognition.timestamp).tz(timezone);
    const weekIndex = Math.floor(moment(Date.now()).tz(timezone).diff(recognitionDate, 'days') / 7);
    
    // Make sure we don't go out of bounds
    if (weekIndex >= 0 && weekIndex < numberOfWeeks) {
      data[weekIndex].y++;
    }
  });
  
  winston.debug("User recognition chart data aggregated by week", {
    func: "service.report.aggregateDataByWeek",
    userId: recognitionData.length > 0 ? recognitionData[0].recognizee : 'unknown',
    timeRange,
    weekCount: numberOfWeeks,
    data: data
  });
  
  return data;
}

module.exports = {
  getTopMessagesForUser,
  getTotalRecognitionsForUser,
  createUserTopMessagesBlocks,
  createUserRecognitionChart
};
