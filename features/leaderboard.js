//const { emoji, maximum } = require('../config')
const recognition = require('../service/recognition')

const rank = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

module.exports = function(controller) {
    controller.hears('leaderboard', 'direct_message, direct_mention', async (bot, message) => {

        let blocks = [];
        blocks = blocks.concat(getContentHeading());

        const recognitionData = await recognition.getPreviousXDaysOfRecognition('America/Los_Angeles', 30);
        const data = aggregateData(recognitionData);

        blocks = blocks.concat(formatRecognizerContent(data.recognizerLeaderboard));
        blocks = blocks.concat(formatRecognizeeContent(data.recognizeeLeaderboard));

        const response = {
            blocks
        }
        await bot.replyEphemeral(
            message,
            response
        )
    });
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
