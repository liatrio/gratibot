const winston = require("../winston");
const recognitionCollection = require("../database/recognitionCollection");
const moment = require("moment-timezone");
const { WebClient } = require("@slack/web-api");

// Initialize the Slack WebClient
const slackClient = new WebClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN);

/**
 * Get user display names from Slack API
 * @param {Array} userIds - Array of user IDs
 * @returns {Object} Map of user IDs to display names
 */
async function getUserDisplayNames(userIds) {
  const userMap = {};
  
  try {
    // Fetch user info in chunks to avoid hitting rate limits
    const chunkSize = 30;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      
      // Use users.info for each user in the chunk
      const userPromises = chunk.map(userId => 
        slackClient.users.info({ user: userId })
          .then(result => ({
            id: userId,
            name: result.user?.real_name || result.user?.name || userId,
            isBot: result.user?.is_bot || false
          }))
          .catch(error => {
            winston.error("Error fetching user info", { userId, error: error.message });
            return { id: userId, name: userId, isBot: false };
          })
      );
      
      // Wait for all user info requests to complete
      const userResults = await Promise.all(userPromises);
      
      // Add to our user map
      userResults.forEach(user => {
        userMap[user.id] = `${user.name}${user.isBot ? ' (bot)' : ''}`;
      });
    }
    
    return userMap;
  } catch (error) {
    winston.error("Error in getUserDisplayNames", { error: error.message });
    // Return an empty map if there's an error
    return {};
  }
}

/**
 * Generate a bar chart of fistbumps received by users
 * @param {number} days - Number of days to look back
 * @returns {Object} Chart configuration for QuickChart
 */
async function generateFistbumpChart(days = 30) {
  try {
    // Get recognitions from the last X days
    const startDate = moment().subtract(days, 'days').toDate();
    const recognitions = await recognitionCollection.find({
      timestamp: { $gte: startDate },
      type: { $ne: 'goldenfistbump' } // Exclude golden fistbumps
    });

    // Group by user and count recognitions
    const userCounts = {};
    recognitions.forEach(rec => {
      userCounts[rec.recognizee] = (userCounts[rec.recognizee] || 0) + 1;
    });

    // Convert to array and sort by count (descending)
    const sortedUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Limit to top 10 users

    if (sortedUsers.length === 0) {
      return null; // No data to display
    }

    // Get display names for all users
    const userIds = sortedUsers.map(user => user.userId);
    const userDisplayNames = await getUserDisplayNames(userIds);

    // Prepare chart data
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];

    // Generate different colors for each bar
    const colorPalette = [
      'rgba(75, 192, 192, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 205, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(201, 203, 207, 0.6)',
      'rgba(255, 99, 71, 0.6)',
      'rgba(147, 112, 219, 0.6)'
    ];

    sortedUsers.forEach(({ userId, count }, index) => {
      // Use display name if available, otherwise fall back to user ID
      const displayName = userDisplayNames[userId] || `User (${userId})`;
      labels.push(displayName);
      data.push(count);
      const colorIndex = index % colorPalette.length;
      backgroundColors.push(colorPalette[colorIndex]);
      borderColors.push(colorPalette[colorIndex].replace('0.6', '1'));
    });

    // Generate chart configuration
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Fistbumps Received',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        title: {
          display: true,
          text: `Fistbumps Received (Last ${days} Days)`,
          fontSize: 16,
          fontFamily: 'Arial'
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              stepSize: 1,
              precision: 0,
              fontFamily: 'Arial'
            },
            scaleLabel: {
              display: true,
              labelString: 'Number of Fistbumps',
              fontFamily: 'Arial'
            }
          }],
          xAxes: [{
            ticks: {
              fontFamily: 'Arial',
              maxRotation: 45,
              minRotation: 45
            },
            scaleLabel: {
              display: true,
              labelString: 'Users',
              fontFamily: 'Arial'
            }
          }]
        },
        legend: {
          display: false
        },
        tooltips: {
          callbacks: {
            label: function(tooltipItem) {
              return `${tooltipItem.yLabel} fistbump${tooltipItem.yLabel !== 1 ? 's' : ''}`;
            }
          },
          titleFontFamily: 'Arial',
          bodyFontFamily: 'Arial'
        }
      }
    };
  } catch (error) {
    winston.error("Error generating fistbump chart", {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get the chart URL from QuickChart
 * @param {Object} chartConfig - Chart.js configuration
 * @returns {string} URL of the generated chart
 */
function getChartUrl(chartConfig) {
  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encodedConfig}&width=800&height=400&devicePixelRatio=2.0`;
}

module.exports = {
  generateFistbumpChart,
  getChartUrl
};
