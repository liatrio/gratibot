const winston = require("../winston");
const recognition = require("./recognition");
const { goldenFistbumpHolder } = require("./golden-recognition");

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

  const { giverScores, receiverScores } = await leaderboardScoreData(timeRange);

  blocks.push(leaderboardHeader());
  blocks.push(await goldenFistbumpHolder());
  blocks.push(topGivers(giverScores));
  blocks.push(topReceivers(receiverScores));
  blocks.push(timeRangeInfo(timeRange));
  blocks.push(timeRangeButtons());

  winston.debug("created leaderboad block", {
    func: "service.leaderboard.createLeaderboardBlocks",
    time_range: timeRange,
  });

  return blocks;
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
 * Generates a Block Kit style object, storing a Top Givers section
 *    header, and leaderboard entries for provided scores.
 * @param {Array<object>} giverScores An array of objects containing a user ID
 *     and a score.
 * @return {object} A Block Kit style object, storing a
 *     section header and leaderboard entries.
 */
function topGivers(giverScores) {
  let markdown = "*Top Givers*\n\n";
  markdown += giverScores.map(leaderboardEntry).join("\n");

  return {
    type: "section",
    block_id: "topGivers",
    text: {
      type: "mrkdwn",
      text: markdown,
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
  let markdown = "*Top Receivers*\n\n";
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
 * @param {number} index A number denoting the rank a particular entry should
 *    be marked with in the leaderboard entry. (Ex: 1st, 2nd 3rd, etc)
 * @return {string} A string of markdown, storing a single leaderboard
 *     entry.
 */
function leaderboardEntry(entry, index) {
  return `<@${entry.userID}> *${rank[index]} - Score:* ${entry.score}`;
}

/* Data Processing */

async function leaderboardScoreData(timeRange) {
  const recognitionData = await recognition.getPreviousXDaysOfRecognition(
    "America/Los_Angeles",
    timeRange
  );
  return aggregateData(recognitionData);
}

function aggregateData(response) {
  /*
   * leaderboard = {
   *     userId: {
   *       totalRecognition: int
   *       uniqueUsers: Set<string>
   *     }
   *   }
   */
  let recognizerLeaderboard = {};
  let recognizeeLeaderboard = {};

  for (let i = 0; i < response.length; i++) {
    let recognizer = response[i].recognizer;
    let recognizee = response[i].recognizee;

    if (!(recognizer in recognizerLeaderboard)) {
      recognizerLeaderboard[recognizer] = {
        totalRecognition: 0,
        uniqueUsers: new Set(),
      };
    }
    if (!(recognizee in recognizeeLeaderboard)) {
      recognizeeLeaderboard[recognizee] = {
        totalRecognition: 0,
        uniqueUsers: new Set(),
      };
    }

    recognizerLeaderboard[recognizer].totalRecognition++;
    recognizerLeaderboard[recognizer].uniqueUsers.add(recognizee);
    recognizeeLeaderboard[recognizee].totalRecognition++;
    recognizeeLeaderboard[recognizee].uniqueUsers.add(recognizer);
  }

  winston.debug("aggregated leaderboard data", {
    func: "service.leaderboard.aggregateData",
  });

  return {
    giverScores: convertToScores(recognizerLeaderboard),
    receiverScores: convertToScores(recognizeeLeaderboard),
  };
}

function convertToScores(leaderboardData) {
  let scores = [];
  for (const user in leaderboardData) {
    let userStats = leaderboardData[user];
    let score =
      1 +
      userStats.totalRecognition -
      userStats.totalRecognition / userStats.uniqueUsers.size;
    score = Math.round(score * 100) / 100;
    scores.push({
      userID: user,
      score: score,
    });
  }
  scores.sort((a, b) => {
    return b.score - a.score;
  });
  return scores.slice(0, 10);
}

/*
 * Replies to a Slack user message with a leaderboard.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering.
 *     this call.
 */
async function respondToLeaderboard({ message, client }) {
  winston.info("@gratibot leaderboard Called", {
    func: "service.leaderboard.respondToLeaderboard",
    callingUser: message.user,
    slackMessage: message.text,
  });
  await client.chat.postEphemeral({
    channel: message.channel,
    user: message.user,
    text: "Gratibot Leaderboard",
    blocks: await createLeaderboardBlocks(30),
  });
  winston.debug("response to leaderboard request was posted to Slack", {
    func: "service.leaderboard.respondToLeaderboard",
    callingUser: message.user,
    slackMessage: message.text,
  });
}

/*
 * Replies to a Slack block_action on an existing leaderboard with updated info.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering
 *     this call.
 */
async function updateLeaderboardResponse({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive leaderboard button clicked", {
    func: "service.leaderboard.updateLeaderboardResponse",
    callingUser: body.user.id,
  });

  await respond({
    blocks: await createLeaderboardBlocks(action.value),
  });
  winston.debug("leaderboard interactive button response posted to Slack", {
    func: "service.leaderboard.updateLeaderboardResponse",
    callingUser: body.user.id,
  });
}

module.exports = {
  createLeaderboardBlocks,
  respondToLeaderboard,
  updateLeaderboardResponse,
  convertToScores,
  aggregateData,
  leaderboardScoreData,
  timeRangeButtons,
  timeRangeInfo,
  topReceivers,
  topGivers,
  leaderboardHeader,
};
