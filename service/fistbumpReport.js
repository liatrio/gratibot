const winston = require('../winston');
const moment = require('moment-timezone');
const recognition = require('./recognition');

// generate chart data for fistbump visualization
async function getFistbumpChartData(timeRange, timezone = 'America/Los_Angeles') {
  const recognitionData = await recognition.getPreviousXDaysOfRecognition(
    timezone,
    timeRange
  );

  // summarize data by recipient
  const userCounts = recognitionData.reduce((acc, record) => {
    const user = record.recognizee;
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {});

  // convert to array and sort by count (descending)
  const sortedData = Object.entries(userCounts)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // top 10 users

  // prepare chart data
  const chart = {
    type: 'bar',
    data: {
      labels: sortedData.map(item => `<@${item.user}>`),
      datasets: [
        {
          label: 'Fistbumps Received',
          data: sortedData.map(item => item.count),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: `Top Fistbump Recipients (Last ${timeRange} days)`,
        fontSize: 16,
      },
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
              precision: 0,
            },
          },
        ],
      },
    },
  };

  winston.debug('fistbump chart data prepared', {
    func: 'service.fistbumpReport.getFistbumpChartData',
    time_range: timeRange,
  });

  return chart;
}

// create visualization report blocks for slack
async function createFistbumpReportBlocks(timeRange, timezone = 'America/Los_Angeles') {
  const blocks = [];

  // generate chart data
  const chart = await getFistbumpChartData(timeRange, timezone);
  const encodedChart = encodeURIComponent(JSON.stringify(chart));
  const imageURL = `https://quickchart.io/chart?c=${encodedChart}`;

  // start and end dates for the report period
  const endDate = moment().tz(timezone);
  const startDate = moment().tz(timezone).subtract(timeRange, 'days');
  const dateRange = `${startDate.format('MMM D')} to ${endDate.format('MMM D, YYYY')}`;

  // create header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: '📊 Weekly Fistbump Report',
      emoji: true,
    },
  });

  // add date range context
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*Period:* ${dateRange}`,
      },
    ],
  });

  // add chart image
  blocks.push({
    type: 'image',
    title: {
      type: 'plain_text',
      text: 'Fistbump Leaderboard',
    },
    image_url: imageURL,
    alt_text: 'Chart showing fistbump recipients',
  });

  // calculate total recognitions for this period
  const totalCount = await recognition.getCountOfRecognitionsInPreviousXDays(timeRange);
  
  // add stats section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Total Fistbumps:* ${totalCount} in the last ${timeRange} days`,
    },
  });

  // add divider
  blocks.push({ type: 'divider' });

  winston.debug('fistbump report blocks created', {
    func: 'service.fistbumpReport.createFistbumpReportBlocks',
    block_count: blocks.length,
    time_range: timeRange,
  });

  return blocks;
}

// post fistbump report to channel
async function postFistbumpReport(client, channelId, timeRange = 7) {
  try {
    const blocks = await createFistbumpReportBlocks(timeRange);
    
    await client.chat.postMessage({
      channel: channelId,
      blocks: blocks,
      text: `Fistbump Report for the last ${timeRange} days`,
    });

    winston.info('fistbump report posted successfully', {
      func: 'service.fistbumpReport.postFistbumpReport',
      channel: channelId,
      time_range: timeRange,
    });
    
    return true;
  } catch (error) {
    winston.error('error posting fistbump report', {
      func: 'service.fistbumpReport.postFistbumpReport',
      error: error.message,
    });
    
    return false;
  }
}

module.exports = {
  getFistbumpChartData,
  createFistbumpReportBlocks,
  postFistbumpReport,
};
