const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const visualization = require("../service/visualization");

module.exports = function (app) {
  app.message(
    /fistbumps(?:\s+(\d+))?/i,
    anyOf(directMention, directMessage()),
    respondToFistbumpsCommand
  );
};

/**
 * Generate the visualization message blocks
 * @param {number} days - Number of days for the time range
 * @param {string} chartUrl - URL of the chart image
 * @returns {Array} Array of Block Kit blocks
 */
async function getVisualizationBlocks(days, chartUrl) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Fistbumps Report (Last ${days} Days)*`
      }
    },
    {
      type: "image",
      image_url: chartUrl,
      alt_text: `Fistbumps received by users over the last ${days} days`
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Use \`@${process.env.BOT_NAME || 'gratibot'} fistbumps [days]\` to view a different time period (max 365 days)`
        }
      ]
    }
  ];
}

async function respondToFistbumpsCommand({ message, client, context }) {
  try {
    const { channel, text, user } = message;
    const match = text.match(/fistbumps(?:\s+(\d+))?/i);
    const days = match && match[1] ? parseInt(match[1]) : 30; // Default to 30 days
    
    // Validate days parameter
    if (days < 1 || days > 365) {
      await client.chat.postEphemeral({
        channel,
        user,
        text: "Please specify a number of days between 1 and 365."
      });
      return;
    }

    // Send a temporary message while generating the chart
    const processingMsg = await client.chat.postMessage({
      channel,
      text: `:hourglass_flowing_sand: Generating fistbumps report for the last ${days} days...`,
      user
    });

    try {
      // Generate the chart
      const chartConfig = await visualization.generateFistbumpChart(days);
      
      if (!chartConfig) {
        await client.chat.update({
          channel,
          ts: processingMsg.ts,
          text: "No fistbump data found for the specified time period."
        });
        return;
      }

      const chartUrl = visualization.getChartUrl(chartConfig);

      // Update the message with the chart
      await client.chat.update({
        channel,
        ts: processingMsg.ts,
        blocks: await getVisualizationBlocks(days, chartUrl)
      });
    } catch (error) {
      winston.error("Error generating chart", {
        error: error.message,
        stack: error.stack
      });
      
      await client.chat.update({
        channel,
        ts: processingMsg.ts,
        text: "❌ Sorry, I couldn't generate the fistbumps report. Please try again later."
      });
    }
  } catch (error) {
    winston.error("Error in fistbumps command", {
      error: error.message,
      stack: error.stack
    });
    
    try {
      await client.chat.postEphemeral({
        channel: message.channel,
        user: message.user,
        text: "❌ An error occurred while processing your request. Please try again later."
      });
    } catch (e) {
      winston.error("Failed to send error message", { error: e });
    }
  }
}
