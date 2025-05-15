const winston = require("../winston");
const recognition = require("./recognition");
const moment = require("moment-timezone");

/**
 * Creates blocks for displaying the most influential recognitions
 * @param {number} days Number of days to look back for recognitions
 * @returns {Array} Array of Slack Block Kit blocks
 */
async function createInfluencersBlocks(days = 30) {
  const timezone = "America/Los_Angeles"; // Default timezone
  const recognitions = await recognition.getPreviousXDaysOfRecognition(timezone, days);
  
  winston.debug(`Creating influencers blocks for the past ${days} days`, {
    func: "service.influencers.createInfluencersBlocks",
    days: days,
    recognitionsCount: recognitions.length,
  });

  let blocks = [];
  
  // Header block
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Top Influential Recognitions (Last ${days} Days)`,
      emoji: true,
    },
  });

  // If no recognitions, show a message
  if (recognitions.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No recognitions have been given in the past " + days + " days.",
      },
    });
    return blocks;
  }

  // Group recognitions by message and separate initial from reactions
  const { influentialRecognitions } = groupAndAnalyzeRecognitions(recognitions);
  
  // Summary block
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `Showing the most influential recognitions that inspired others to recognize as well.`,
    },
  });

  // Divider
  blocks.push({ type: "divider" });

  // If no influential recognitions, show a message
  if (influentialRecognitions.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No influential recognitions found in the past " + days + " days. Influential recognitions are initial recognitions that inspired reaction recognitions with the same message.",
      },
    });
  } else {
    // Create blocks for influential recognitions
    const recognitionBlocks = createInfluentialRecognitionBlocks(influentialRecognitions);
    blocks = blocks.concat(recognitionBlocks);
    
    // Add note if we're not showing all influential recognitions
    if (influentialRecognitions.length > 10) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Showing top 10 of ${influentialRecognitions.length} influential recognitions. Slack has a limit on how many can be displayed._`,
          },
        ],
      });
    }
  }

  // Time range info
  blocks.push({
    type: "context",
    elements: [
      {
        type: "plain_text",
        text: `Showing data from the last ${days} days`,
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
 * Groups recognitions by message and analyzes which initial recognitions inspired the most reactions
 * @param {Array} recognitions Array of recognition objects
 * @returns {Object} Object containing influential recognitions sorted by reaction count
 */
function groupAndAnalyzeRecognitions(recognitions) {
  // Create maps to track initial and reaction recognitions by message
  const messageGroups = new Map();
  
  // First pass: organize all recognitions by message
  recognitions.forEach(rec => {
    const message = rec.message.trim();
    const recognitionSource = rec.recognitionSource || "initial"; // Default to initial if not set
    
    if (!messageGroups.has(message)) {
      messageGroups.set(message, {
        message: message,
        initialRecognitions: [],
        reactionRecognitions: [],
        reactionCount: 0
      });
    }
    
    const group = messageGroups.get(message);
    
    // Separate initial and reaction recognitions
    if (recognitionSource === "initial") {
      group.initialRecognitions.push(rec);
    } else {
      group.reactionRecognitions.push(rec);
      group.reactionCount++;
    }
  });
  
  // Create array of influential recognitions (those with at least one initial and one reaction)
  const influentialRecognitions = [];
  
  messageGroups.forEach(group => {
    // Only include messages that have both initial recognitions and reactions
    if (group.initialRecognitions.length > 0 && group.reactionRecognitions.length > 0) {
      // Find the earliest initial recognition as the "originator"
      const originator = group.initialRecognitions.reduce((earliest, current) => {
        return new Date(current.timestamp) < new Date(earliest.timestamp) ? current : earliest;
      }, group.initialRecognitions[0]);
      
      influentialRecognitions.push({
        message: group.message,
        originator: originator,
        reactionCount: group.reactionCount,
        uniqueReactors: new Set(group.reactionRecognitions.map(r => r.recognizer)).size,
        initialCount: group.initialRecognitions.length,
        totalCount: group.initialRecognitions.length + group.reactionRecognitions.length
      });
    }
  });
  
  // Sort by reaction count (descending)
  influentialRecognitions.sort((a, b) => b.reactionCount - a.reactionCount);
  
  return { influentialRecognitions };
}

/**
 * Creates blocks for influential recognitions
 * @param {Array} influentialRecognitions Array of influential recognition objects
 * @returns {Array} Array of Slack Block Kit blocks
 */
function createInfluentialRecognitionBlocks(influentialRecognitions) {
  const blocks = [];
  
  // Limit to top 10 most influential recognitions
  const limitedRecognitions = influentialRecognitions.slice(0, 10);

  limitedRecognitions.forEach((item, index) => {
    // Format the date
    const date = moment(item.originator.timestamp).format("MMM D, YYYY");
    
    // Truncate message if it's too long
    const maxMessageLength = 200;
    let message = item.message;
    if (message.length > maxMessageLength) {
      message = message.substring(0, maxMessageLength) + "...";
    }
    
    // Create section block with message and influence stats
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${index + 1}. Recognition by <@${item.originator.recognizer}> to <@${item.originator.recognizee}>* (${date})\n>${message}\n_Inspired ${item.reactionCount} reaction${item.reactionCount !== 1 ? 's' : ''}_`,
      },
    });

    // Add divider between items (except after the last one)
    if (index < limitedRecognitions.length - 1) {
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
    block_id: "influencersButtons",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "7 Days",
        },
        value: "7",
        action_id: "influencers-7",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "30 Days",
        },
        value: "30",
        action_id: "influencers-30",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "90 Days",
        },
        value: "90",
        action_id: "influencers-90",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "All Time",
        },
        value: "3650",
        action_id: "influencers-3650",
      },
    ],
  };
}

module.exports = {
  createInfluencersBlocks,
};
