//const { emoji, maximum } = require('../config')
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

async function createLeaderboardBlocks(dataPeriod) {
    let blocks = [];
    blocks = blocks.concat(getContentHeading());

    const recognitionData = await recognition.getPreviousXDaysOfRecognition('America/Los_Angeles', dataPeriod);
    const data = aggregateData(recognitionData);

    blocks = blocks.concat(formatRecognizerContent(data.recognizerLeaderboard));
    blocks = blocks.concat(formatRecognizeeContent(data.recognizeeLeaderboard));

    blocks.push(dataTimePeriodBlock(dataPeriod));
    blocks.push(timePeriodButtons());

    return { blocks }
}

function getContentHeading() {
    return [{
        type: 'section',
        block_id: 'heading',
        text: {
            type: 'mrkdwn',
            text: '*Leaderboard*',
        }
    }]
};

function formatSortedRankData(entry, index) {
    return {
        type: 'context',
        elements: [
            { type: 'mrkdwn', text: `<@${entry.userID}> *${rank[index]} - Score:* ${entry.score}\n` },
        ],
    }
}

function formatRecognizerContent(recognizerLeaderboard) {
    let content = [{
        type: 'section',
        block_id: 'recognizersTitle',
        text: {
            type: 'mrkdwn',
            text: '*Top Givers*',
        },
    }]
    let cleanedData = convertData(recognizerLeaderboard);
    let formatedData = cleanedData.map(formatSortedRankData);
    content = content.concat(formatedData);
    return content
}

function formatRecognizeeContent(recognizeeLeaderboard) {
    let content = [{
        type: 'section',
        block_id: 'recognizeesTitle',
        text: {
            type: 'mrkdwn',
            text: '*Top Receivers*',
        },
    }]
    let cleanedData = convertData(recognizeeLeaderboard);
    let formatedData = cleanedData.map(formatSortedRankData);
    content = content.concat(formatedData);
    return content
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
    }

    for(let i = 0; i < response.length; i++) {
        let recognizer = response[i].recognizer;
        let recognizee = response[i].recognizee;

        recognizerLeaderboard[recognizer].totalRecognition++;
        recognizerLeaderboard[recognizer].uniqueUsers.add(recognizee);
        recognizeeLeaderboard[recognizee].totalRecognition++;
        recognizeeLeaderboard[recognizee].uniqueUsers.add(recognizer);
    }
    return {
        recognizerLeaderboard,
        recognizeeLeaderboard
    }
}

function convertData(leaderboardData) {
    let sortableData = [];
    for(const user in leaderboardData) {
        let userStats = leaderboardData[user]
        let score = 1 + userStats.totalRecognition - (userStats.totalRecognition / userStats.uniqueUsers.size)
        score = Math.round(score * 100) / 100;
        sortableData.push({
            userID: user,
            score: score
        });
    }
    sortableData.sort((a, b) => {
        return b.score - a.score;
    });
    sortableData.slice(0, 10);
    return sortableData;
}

function dataTimePeriodBlock(dataPeriod) {
    return {
        type: 'context',
        block_id: 'timeRange',
        elements: [
            {
                type: 'plain_text',
                text: `Last ${dataPeriod} days`,
                emoji: true,
            },
        ],
    };
}

function timePeriodButtons() {
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
