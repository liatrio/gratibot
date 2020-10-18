const moment = require('moment-timezone');

const recognition = require('../service/recognition');
const winston = require('../winston');


module.exports = function(controller) {
    controller.hears(
        'metrics',
        ['direct_message', 'direct_mention'],
        respondToMetrics
    );

    controller.on(
        'block_actions',
        updateMetricsResponse,
    );
}

async function respondToMetrics(bot, message) {
    winston.info(
        '@gratibot metrics Called',
        {
            callingUser: message.user,
            slackMessage: message.text,
        },
    );
    await bot.replyEphemeral(
        message,
        await createMetricsBlocks(30),
    );
}

async function updateMetricsResponse(bot, message) {
    if (message.actions[0].block_id !== 'metricsButtons') {
        return;
    }

    winston.info(
        'Gratibot interactive metrics button clicked',
        {
            callingUser: message.user,
        },
    );

    await bot.replyInteractive(
        message,
        await createMetricsBlocks(message.actions[0].value),
    );
}

async function createMetricsBlocks(timeRange) {
    let blocks = [];

    const chart = await metricsChartData(timeRange);

    const encodedChart = encodeURIComponent(JSON.stringify(chart));
    const imageURL = `https://quickchart.io/chart?c=${encodedChart}`;

    blocks.push(metricsHeader());
    blocks.push(metricsGraph(imageURL));
    blocks.push(timeRangeInfo(timeRange));
    blocks.push(timeRangeButtons());

    return { blocks }
}

/* Block Kit Content */

function metricsHeader() {
    return {
        type: 'section',
        block_id: 'metricsHeader',
        text: {
            type: 'mrkdwn',
            text: '*Metrics*',
        }
    };
}

function metricsGraph(imageURL) {
    return {
        "type": "image",
        "title": {
            "type": "plain_text",
            "text": "Gratibot Metrics"
        },
        "block_id": "metricsGraph",
        "image_url": imageURL,
        "alt_text": "Chart showing Gratibot usage over time"
    }
}

function timeRangeInfo(timeRange) {
    return {
        type: 'context',
        block_id: 'metricsTimeRange',
        elements: [
            {
                type: 'plain_text',
                text: `Last ${timeRange} days`,
                emoji: true,
            },
        ],
    };
}

function timeRangeButtons() {
    return {
        type: 'actions',
        block_id: 'metricsButtons',
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
            /*
             * Currently non-functional due to too much header data being sent to
             * quickchart.io, TODO: possibly solvable by combining entries
             * locally before sending graph for rendering.
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Year',
                },
                value: '365',
            },
            */
        ],
    }
}

/* Data Processing */

async function metricsChartData(timeRange) {
    const recognitionData = await recognition.getPreviousXDaysOfRecognition('America/Los_Angeles', timeRange);
    const chart = {
        type: 'bar',
        data: {
            datasets: [
                {
                    label: 'Recognition',
                    data: aggregateData(recognitionData, timeRange),
                },
            ],
        },
        options: {
            scales: {
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                }],
            }
        }
    };
    return chart;
}

function aggregateData(response, timeRange) {
    let data = [];
    let currentTime = moment(Date.now()).tz('America/Los_Angeles');
    for(let i = 0; i < timeRange; i++) {
        data.push({
            x: currentTime.subtract(1, 'days').format('YYYY-MM-DD'),
            y: 0,
        })
    }
    data = data.reverse();

    let recognitionDate = null;
    let index = 0;
    currentTime = moment(Date.now()).tz('America/Los_Angeles');

    for(let i = 0; i < response.length; i++) {
        recognitionDate = moment(response[i].timestamp).tz('America/Los_Angeles');
        index = currentTime.diff(recognitionDate, 'days');
        data[(timeRange - 1) - index].y++;
    }
    return data;
}
