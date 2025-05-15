const winston = require("../winston");
const recognition = require("./recognition");

const rank = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
];

/*
 * Generates leaderboard message data in Slack's Block Kit style format.
 * @param {number} timeRange A number denoting the number of days of data
 *     the created leaderboard will include.
 * @return {object} A Block Kit style object, storing a Gratibot leaderboard.
 */
async function createLeaderboardBlocks(timeRange) {
  let blocks = [];

  const { 
    receiverScores, 
    initialGiverScores, 
    weightedGiverScores 
  } = await leaderboardScoreData(timeRange);

  blocks.push(leaderboardHeader());
  blocks.push(await goldenFistbumpHolder());
  
  // Add weighted scores (counts initial as 1.0 and reactions as 0.5)
  blocks.push(topWeightedGivers(weightedGiverScores));
  
  // Add receivers (all count as 1.0)
  blocks.push(topReceivers(receiverScores));
  
  // Add breakdown of initial recognitions
  blocks.push(topInitialGivers(initialGiverScores));
  
  blocks.push(timeRangeInfo(timeRange));
  blocks.push(timeRangeButtons());

  winston.debug("created leaderboad block", {
    func: "service.leaderboard.createLeaderboardBlocks",
    time_range: timeRange,
  });

  return blocks;
}

async function goldenFistbumpHolder() {
  let { goldenFistbumpHolder, message, timestamp } =
    await recognition.getGoldenFistbumpHolder();
  let receivedDate = new Date(timestamp);
  receivedDate = receivedDate.toLocaleDateString().substring(0, 10);

  let markdown = `*Current Golden Fistbump Holder. Received ${receivedDate}*\n\n`;
  markdown += `<@${goldenFistbumpHolder}> - *${message}*`;

  return {
    type: "section",
    block_id: "goldenFistbumpHolder",
    text: {
      type: "mrkdwn",
      text: markdown,
    },
  };
}

/* Block Kit Content */

/*
 * Generates a Block Kit style object, storing a leaderboard header.
 * @return {object} A Block Kit style object, storing a leaderboard header.
 */
function leaderboardHeader() {
  return {
    type: "section",
    block_id: "leaderboardHeader",
    text: {
      type: "mrkdwn",
      text: "*Leaderboard*",
    },
  };
}

/*
 * Generates a Block Kit style object, storing a Top Receivers section
 *    header, and leaderboard entries for provided scores.
 * @param {Array<object>} receiverScores An array of objects containing a user
 *     ID and a score.
 * @return {object} A Block Kit style object, storing a
 *     section header and leaderboard entries.
 */
function topReceivers(receiverScores) {
  let markdown = "*Top Receivers (Total)*\n\n";
  markdown += receiverScores.map(leaderboardEntry).join("\n");

  return {
    type: "section",
    block_id: "topReceivers",
    text: {
      type: "mrkdwn",
      text: markdown,
    },
  };
}

/*
 * Generates a Block Kit style object, storing information denoting the
 *     timeRange of the generated leaderboard.
 * @param {number} timeRange A number denoting the number of days of data
 *     the created leaderboard includes.
 * @return {object} A Block Kit style objects, storing information denoting
 *     the timeRange of the generated leaderboard.
 */
function timeRangeInfo(timeRange) {
  return {
    type: "context",
    block_id: "timeRange",
    elements: [
      {
        type: "plain_text",
        text: `Last ${timeRange} days`,
        emoji: true,
      },
    ],
  };
}

/*
 * Generates a Block Kit style object, containing buttons for generating
 *     a leaderboard with different timeRanges.
 * @return {object} A Block Kit style objects, containing buttons for generating
 *     a leaderboard with different timeRanges.
 */
function timeRangeButtons() {
  return {
    type: "actions",
    block_id: "leaderboardButtons",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Today",
        },
        value: "1",
        action_id: "leaderboard-1",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Week",
        },
        value: "7",
        action_id: "leaderboard-7",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Month",
        },
        value: "30",
        action_id: "leaderboard-30",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Year",
        },
        value: "365",
        action_id: "leaderboard-365",
      },
    ],
  };
}

/*
 * Generates a markdown string, containing a single leaderboard
 *     entry. Used with Array.map() to format score data.
 * @param {object} entry An object containing a userID and a corresponding
 *    score for a leaderboard entry.
 * @return {string} A string of markdown, storing a single leaderboard
 *     entry.
 */
function leaderboardEntry(entry) {
  // Format the score to show 1 decimal place if it's not a whole number
  const formattedScore = Number.isInteger(entry.score) ? entry.score : entry.score.toFixed(1);
  return `<@${entry.userId}> - ${formattedScore}`;
}

/*
 * Generates a Block Kit style object, storing a Top Weighted Givers section
 * header, and leaderboard entries for provided scores.
 * @param {Array<object>} weightedGiverScores An array of objects containing a user ID
 *     and a weighted score (initial=1.0, reaction=0.5).
 * @return {object} A Block Kit style object, storing a
 *     section header and leaderboard entries.
 */
function topWeightedGivers(weightedGiverScores) {
  let markdown = "*Top Givers (Weighted)*\n\n";
  markdown += "_Initial recognitions = 1.0, Reactions = 0.5_\n\n";
  markdown += weightedGiverScores.map(leaderboardEntry).join("\n");

  return {
    type: "section",
    block_id: "topWeightedGivers",
    text: {
      type: "mrkdwn",
      text: markdown,
    },
  };
}

/*
 * Generates a Block Kit style object, storing a Top Initial Givers section
 * header, and leaderboard entries for provided scores.
 * @param {Array<object>} initialGiverScores An array of objects containing a user ID
 *     and a score for initial recognitions.
 * @return {object} A Block Kit style object, storing a
 *     section header and leaderboard entries.
 */
function topInitialGivers(initialGiverScores) {
  let markdown = "*Top Initial Recognition Givers*\n\n";
  markdown += initialGiverScores.map(leaderboardEntry).join("\n");

  return {
    type: "section",
    block_id: "topInitialGivers",
    text: {
      type: "mrkdwn",
      text: markdown,
    },
  };
}

/* Data Processing */

async function leaderboardScoreData(timeRange) {
  const recognitionData = await recognition.getPreviousXDaysOfRecognition(
    "America/Los_Angeles",
    timeRange,
  );
  return aggregateData(recognitionData);
}

function aggregateData(response) {
  /*
   * leaderboard = {
   *     userId: {
   *       totalRecognition: float
   *       uniqueUsers: Set<string>
   *       initialRecognitions: int
   *       reactionRecognitions: int
   *       weightedRecognition: float
   *     }
   *   }
   */
  let recognizerLeaderboard = {};
  let recognizeeLeaderboard = {};

  for (let i = 0; i < response.length; i++) {
    let recognizer = response[i].recognizer;
    let recognizee = response[i].recognizee;
    let recognitionSource = response[i].recognitionSource || "initial";
    let recognitionWeight = recognitionSource === "initial" ? 1.0 : 0.5;

    if (!(recognizer in recognizerLeaderboard)) {
      recognizerLeaderboard[recognizer] = {
        totalRecognition: 0,
        uniqueUsers: new Set(),
        initialRecognitions: 0,
        reactionRecognitions: 0,
        weightedRecognition: 0
      };
    }
    if (!(recognizee in recognizeeLeaderboard)) {
      recognizeeLeaderboard[recognizee] = {
        totalRecognition: 0,
        uniqueUsers: new Set(),
        initialRecognitions: 0,
        reactionRecognitions: 0,
        weightedRecognition: 0
      };
    }

    // Increment total recognitions
    recognizerLeaderboard[recognizer].totalRecognition++;
    recognizeeLeaderboard[recognizee].totalRecognition++;
    
    // Track initial vs reaction recognitions
    if (recognitionSource === "initial") {
      recognizerLeaderboard[recognizer].initialRecognitions++;
    } else {
      recognizerLeaderboard[recognizer].reactionRecognitions++;
    }
    
    // Add weighted recognition
    recognizerLeaderboard[recognizer].weightedRecognition += recognitionWeight;
    recognizeeLeaderboard[recognizee].weightedRecognition += recognitionWeight;
    
    // Add unique users
    recognizerLeaderboard[recognizer].uniqueUsers.add(recognizee);
    recognizeeLeaderboard[recognizee].uniqueUsers.add(recognizer);
  }

  winston.debug("aggregated leaderboard data", {
    func: "service.leaderboard.aggregateData",
  });

  return {
    receiverScores: convertToScores(recognizeeLeaderboard),
    initialGiverScores: convertToInitialScores(recognizerLeaderboard),
    weightedGiverScores: convertToWeightedScores(recognizerLeaderboard)
  };
}

function convertToScores(leaderboard) {
  let scores = [];
  for (let userId in leaderboard) {
    if (userId === "goldenFistbumpMultiplier") continue;
    scores.push({
      userId: userId,
      score: leaderboard[userId].totalRecognition,
      unique: leaderboard[userId].uniqueUsers.size,
    });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 10);
}

function convertToInitialScores(leaderboard) {
  let scores = [];
  for (let userId in leaderboard) {
    if (userId === "goldenFistbumpMultiplier") continue;
    scores.push({
      userId: userId,
      score: leaderboard[userId].initialRecognitions,
      unique: leaderboard[userId].uniqueUsers.size,
    });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 10);
}

function convertToWeightedScores(leaderboard) {
  let scores = [];
  for (let userId in leaderboard) {
    if (userId === "goldenFistbumpMultiplier") continue;
    scores.push({
      userId: userId,
      score: leaderboard[userId].weightedRecognition,
      unique: leaderboard[userId].uniqueUsers.size,
    });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 10);
}

module.exports = {
  createLeaderboardBlocks,
};
