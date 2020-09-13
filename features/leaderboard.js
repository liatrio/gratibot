const recognition = require('../service/recognition');
const winston = require('../winston');

const rank = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

module.exports = function(controller) {
    controller.hears(
        'leaderboard',
        ['direct_message', 'direct_mention'],
        respondToLeaderboard
    );

    controller.on(
        'block_actions',
        updateLeaderboardResponse,
    );
}

/*
 * Replies to a Slack user message with a leaderboard.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering.
 *     this call.
 */
async function respondToLeaderboard(bot, message) {
    winston.info(
        '@gratibot leaderboard Called',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    await bot.replyEphemeral(
        message,
        await createLeaderboardBlocks(30),
    );
}

/*
 * Replies to a Slack block_action on an existing leaderboard with updated info.
 * @param {object} bot A Botkit bot object.
 * @param {object} message A botkit message object, denoting the message triggering
 *     this call.
 */
async function updateLeaderboardResponse(bot, message) {
    if (message.actions[0].block_id !== 'leaderboardButtons') {
        return;
    }

    winston.info(
        'Gratibot interactive leaderboard button clicked',
        {
            callingUser: message.user,
        },
    );

    await bot.replyInteractive(
        message,
        await createLeaderboardBlocks(message.actions[0].value),
    );
}

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
    blocks.push(...topGivers(giverScores));
    blocks.push(...topReceivers(receiverScores));
    blocks.push(timeRangeInfo(timeRange));
    blocks.push(timeRangeButtons());

    return { blocks }
}

/* Block Kit Content */

/*
 * Generates a Block Kit style object, storing a leaderboard header.
 * @return {object} A Block Kit style object, storing a leaderboard header.
 */
function leaderboardHeader() {
    return {
        type: 'section',
        block_id: 'leaderboard_header',
        text: {
            type: 'mrkdwn',
            text: '*Leaderboard*',
        }
    };
}

/*
 * Generates an array of Block Kit style objects, storing a Top Givers section
 *    header, and leaderboard entries for provided scores.
 * @param {Array<object>} giverScores An array of objects containing a user ID
 *     and a score.
 * @return {Array<object>} An array of Block Kit style objects, storing a
 *     section header and leaderboard entries.
 */
function topGivers(giverScores) {
    let content = [{
        type: 'section',
        block_id: 'recognizersTitle',
        text: {
            type: 'mrkdwn',
            text: '*Top Givers*',
        },
    }]
    return content.concat(
        giverScores.map(leaderboardEntry)
    );
}

/*
 * Generates an array of Block Kit style objects, storing a Top Receivers section
 *    header, and leaderboard entries for provided scores.
 * @param {Array<object>} receiverScores An array of objects containing a user
 *     ID and a score.
 * @return {Array<object>} An array of Block Kit style objects, storing a
 *     section header and leaderboard entries.
 */
function topReceivers(receiverScores) {
    let content = [{
        type: 'section',
        block_id: 'recognizeesTitle',
        text: {
            type: 'mrkdwn',
            text: '*Top Receivers*',
        },
    }]
    return content.concat(
        receiverScores.map(leaderboardEntry)
    );
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
        type: 'context',
        block_id: 'timeRange',
        elements: [
            {
                type: 'plain_text',
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
        type: 'actions',
        block_id: 'leaderboardButtons',
        elements: [
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Today',
                },
                value: '1',
            },
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Week',
                },
                value: '7',
            },
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Month',
                },
                value: '30',
            },
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Year',
                },
                value: '365',
            },
        ],
    }
}

/*
 * Generates a Block Kit style object, containing a single leaderboard
 *     entry. Used with Array.map() to format score data.
 * @param {object} entry An object containing a userID and a corresponding
 *    score for a leaderboard entry.
 * @param {number} index A number denoting the rank a particular entry should
 *    be marked with in the leaderboard entry. (Ex: 1st, 2nd 3rd, etc)
 * @return {object} A Block Kit style object, storing a single leaderboard
 *     entry.
 */
function leaderboardEntry(entry, index) {
    return {
        type: 'context',
        elements: [
            { type: 'mrkdwn', text: `<@${entry.userID}> *${rank[index]} - Score:* ${entry.score}\n` },
        ],
    }
}

/* Data Processing */

async function leaderboardScoreData(timeRange) {
    const recognitionData = await recognition.getPreviousXDaysOfRecognition('America/Los_Angeles', timeRange);
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
    let recognizerLeaderboard = {}
    let recognizeeLeaderboard = {}

    for(let i = 0; i < response.length; i++) {
        let recognizer = response[i].recognizer;
        let recognizee = response[i].recognizee;

        if(!(recognizer in recognizerLeaderboard)) {
            recognizerLeaderboard[recognizer] = {
                totalRecognition: 0,
                uniqueUsers: new Set()
            }
        }
        if(!(recognizee in recognizeeLeaderboard)) {
            recognizeeLeaderboard[recognizee] = {
                totalRecognition: 0,
                uniqueUsers: new Set()
            }
        }

        recognizerLeaderboard[recognizer].totalRecognition++;
        recognizerLeaderboard[recognizer].uniqueUsers.add(recognizee);
        recognizeeLeaderboard[recognizee].totalRecognition++;
        recognizeeLeaderboard[recognizee].uniqueUsers.add(recognizer);
    }

    return {
        giverScores: convertToScores(recognizerLeaderboard),
        receiverScores: convertToScores(recognizeeLeaderboard),
    }
}

function convertToScores(leaderboardData) {
    let scores = [];
    for(const user in leaderboardData) {
        let userStats = leaderboardData[user]
        let score = 1 + userStats.totalRecognition - (userStats.totalRecognition / userStats.uniqueUsers.size)
        score = Math.round(score * 100) / 100;
        scores.push({
            userID: user,
            score: score
        });
    }
    scores.sort((a, b) => {
        return b.score - a.score;
    });
    scores.slice(0, 10);
    return scores;
}
