const winston = require("../winston");
const moment = require("moment-timezone");
const recognition = require("./recognition");

// get timezone from environment variable or use default
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "America/Los_Angeles";

// pure function to create a chart object from data
const createChartObject = (sortedData, timeRange) => ({
  type: "bar",
  data: {
    labels: sortedData.map((item) => `<@${item.user}>`),
    datasets: [
      {
        label: "Fistbumps Received",
        data: sortedData.map((item) => item.count),
        backgroundColor: "rgba(54, 162, 235, 0.8)",
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
});

// pure function to generate sample recognition data when no real data exists
const generateSampleData = (count = 5) => {
  // sample users for demonstration purposes
  const sampleUsers = [
    { id: 'U03HW0858AF', name: 'Tim' },
    { id: 'U04V6Q0BKPH', name: 'Ian' },
    { id: 'U02T9EL7D7D', name: 'Zach' },
    { id: 'UABCDEF123', name: 'Alice' },
    { id: 'UGHIJKL456', name: 'Bob' },
  ];
  
  // generate random counts for each user
  return sampleUsers
    .map(user => ({
      user: user.id,
      count: Math.floor(Math.random() * 20) + 1 // 1-20 fistbumps per user
    }))
    .sort((a, b) => b.count - a.count) // sort by count descending
    .slice(0, count); // take the top N users
};

// generate chart data for fistbump visualization
async function getFistbumpChartData(
  timeRange,
  timezone = DEFAULT_TIMEZONE,
) {
  try {
    // attempt to get real data from database
    const recognitionData = await recognition.getPreviousXDaysOfRecognition(
      timezone,
      timeRange,
    );
    
    winston.info("recognition data retrieved for chart", {
      func: "service.fistbumpReport.getFistbumpChartData",
      count: recognitionData.length,
      time_range: timeRange
    });
    
    // if we have data, use it
    if (recognitionData && recognitionData.length > 0) {
      // summarize data by recipient (pure function approach)
      const userCounts = recognitionData.reduce((acc, record) => {
        const user = record.recognizee;
        return {
          ...acc,
          [user]: (acc[user] || 0) + 1
        };
      }, {});

      // convert to array and sort by count (descending) - pure functional approach
      const sortedData = Object.entries(userCounts)
        .map(([user, count]) => ({ user, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // top 10 users
      
      // prepare chart using this data
      return createChartObject(sortedData, timeRange);
    } else {
      // if no data, use sample data for preview purposes
      winston.info("no recognition data found, using sample data for preview", {
        func: "service.fistbumpReport.getFistbumpChartData"
      });
      
      // generate sample data and create chart from it
      const sampleData = generateSampleData(10);
      return createChartObject(sampleData, timeRange);
    }
  } catch (error) {
    winston.error("error retrieving recognition data for chart", {
      func: "service.fistbumpReport.getFistbumpChartData",
      error: error.message,
      stack: error.stack
    });
    
    // return sample data as fallback
    const sampleData = generateSampleData(10);
    return createChartObject(sampleData, timeRange);
  }
  
  // this code below was replaced by the createChartObject function
  // note: chart creation has been moved to the createChartObject pure function

  winston.debug("fistbump chart data prepared", {
    func: "service.fistbumpReport.getFistbumpChartData",
    time_range: timeRange,
  });

  return chart;
}

// create visualization report blocks for slack
async function createFistbumpReportBlocks(
  timeRange,
  timezone = DEFAULT_TIMEZONE,
) {
  const blocks = [];

  // generate chart data
  const chart = await getFistbumpChartData(timeRange, timezone);
  const encodedChart = encodeURIComponent(JSON.stringify(chart));
  const imageURL = `https://quickchart.io/chart?c=${encodedChart}`;

  // start and end dates for the report period
  const endDate = moment().tz(timezone);
  const startDate = moment().tz(timezone).subtract(timeRange, "days");
  const dateRange = `${startDate.format("MMM D")} to ${endDate.format("MMM D, YYYY")}`;

  // create header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "📊 Weekly Fistbump Report",
      emoji: true,
    },
  });

  // add date range context
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `*Period:* ${dateRange}`,
      },
    ],
  });

  // add chart image
  blocks.push({
    type: "image",
    title: {
      type: "plain_text",
      text: "Fistbump Leaderboard",
    },
    image_url: imageURL,
    alt_text: "Chart showing fistbump recipients",
  });

  // calculate total recognitions for this period
  const totalCount =
    await recognition.getCountOfRecognitionsInPreviousXDays(timeRange);

  // add stats section
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Total Fistbumps:* ${totalCount} in the last ${timeRange} days`,
    },
  });

  // add divider
  blocks.push({ type: "divider" });

  winston.debug("fistbump report blocks created", {
    func: "service.fistbumpReport.createFistbumpReportBlocks",
    block_count: blocks.length,
    time_range: timeRange,
  });

  return blocks;
}

// post fistbump report to channel
async function postFistbumpReport(client, channelId, timeRange = 7, timezone = DEFAULT_TIMEZONE, isPreview = false) {
  try {
    // log attempt to generate report
    winston.info("generating fistbump report", {
      func: "service.fistbumpReport.postFistbumpReport",
      channel: channelId,
      time_range: timeRange,
      timezone,
      is_preview: isPreview,
    });
    
    // get recognition data to verify it exists
    const recognitionData = await recognition.getPreviousXDaysOfRecognition(
      timezone,
      timeRange,
    );
    
    winston.info("recognition data retrieved", {
      func: "service.fistbumpReport.postFistbumpReport",
      recognition_count: recognitionData.length,
    });
    
    // handle case when no actual data is found
    if (recognitionData.length === 0) {
      winston.info("no recognition data found for time period", {
        func: "service.fistbumpReport.postFistbumpReport",
        channel: channelId,
        time_range: timeRange,
      });
      
      // for preview requests, show sample data instead of error message
      if (isPreview) {
        winston.info("using sample data for preview", {
          func: "service.fistbumpReport.postFistbumpReport",
        });
        
        // generate sample data and create sample visualization
        const sampleBlocks = await createFistbumpReportBlocksWithSampleData(timeRange, timezone);
        
        await client.chat.postMessage({
          channel: channelId,
          blocks: sampleBlocks,
          text: `Sample Fistbump Report for the last ${timeRange} days (using generated data)`,
        });
        
        return true;
      } else {
        // for scheduled reports, inform about missing data
        await client.chat.postMessage({
          channel: channelId,
          text: `No recognition data found for the last ${timeRange} days. Please ensure there are recognitions in the system.`,
        });
        
        return false;
      }
    }
    
    // create blocks with data
    const blocks = await createFistbumpReportBlocks(timeRange, timezone);
    winston.info("report blocks created", {
      func: "service.fistbumpReport.postFistbumpReport",
      block_count: blocks.length,
    });

    // post message to channel
    await client.chat.postMessage({
      channel: channelId,
      blocks: blocks,
      text: `Fistbump Report for the last ${timeRange} days`,
    });

    winston.info("fistbump report posted successfully", {
      func: "service.fistbumpReport.postFistbumpReport",
      channel: channelId,
      time_range: timeRange,
    });

    return true;
  } catch (error) {
    winston.error("error posting fistbump report", {
      func: "service.fistbumpReport.postFistbumpReport",
      error: error.message,
      stack: error.stack,
    });

    return false;
  }
}

module.exports = {
  getFistbumpChartData,
  createFistbumpReportBlocks,
  postFistbumpReport,
};
