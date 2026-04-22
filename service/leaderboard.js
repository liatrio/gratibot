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

function leaderboardEntry(entry, index) {
  return `<@${entry.userID}> *${rank[index]} - Score:* ${entry.score}`;
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
    // Diversity-weighted: subtracting total/unique penalises concentration, so
    // N recognitions from N distinct users score ~N, but N from one user score ~1.
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

module.exports = {
  createLeaderboardBlocks,
};
