// Renders the service/report.js when using the command "report" in Slack 
const report = require("../service/report");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");

module.exports = function (app) {
  // Handle direct "report" command
  app.message(
    /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
    anyOf(directMessage(), directMention),
    respondToReport
  );
  
  // Handle button clicks for different time ranges
  app.action(/user-top-messages-\d+/, updateReportTimeRange);
};

async function respondToReport({ message, client, context }) {
  winston.info("@gratibot report Called", {
    func: "feature.report.respondToReport",
    callingUser: message.user,
    slackMessage: message.text,
  });
  
  // Check if a specific user was mentioned in the command
  const mentionMatch = message.text.match(/<@([a-zA-Z0-9]+)>/i);
  const targetUserId = mentionMatch ? mentionMatch[1] : message.user;
  
  // Check if a time range was specified
  const timeRangeMatch = message.text.match(/\s+(\d+)\s*$/i);
  
  try {
    // Get user info to verify the user exists
    const userInfo = await client.users.info({ user: targetUserId });
    if (!userInfo.ok) {
      throw new Error(`Error retrieving user info: ${userInfo.error}`);
    }
    
    // Use specified time range or default to 180 days
    const timeRange = timeRangeMatch ? parseInt(timeRangeMatch[1]) : 180;
    
    // Get the top messages and total recognitions for the user
    const topMessages = await report.getTopMessagesForUser(targetUserId, timeRange, userInfo.user.tz);
    const totalRecognitions = await report.getTotalRecognitionsForUser(targetUserId, timeRange, userInfo.user.tz);
    
    // Create the blocks for the message - now awaiting since it's async
    const blocks = await report.createUserTopMessagesBlocks(
      targetUserId,
      topMessages,
      totalRecognitions,
      timeRange
    );
    
    // Send the report as an ephemeral message
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `Top recognized messages for <@${targetUserId}>`,
      blocks: blocks,
    });
    
    winston.debug("report command response posted to Slack", {
      func: "feature.report.respondToReport",
      callingUser: message.user,
      targetUser: targetUserId,
      slackMessage: message.text,
    });
  } catch (error) {
    winston.error("Error generating report", {
      func: "feature.report.respondToReport",
      callingUser: message.user,
      targetUser: targetUserId,
      error: error.message,
    });
    
    await client.chat.postEphemeral({
      channel: message.channel,
      user: message.user,
      text: `Something went wrong while generating the report: ${error.message}`,
    });
  }
}

async function updateReportTimeRange({ ack, body, action, respond }) {
  await ack();
  winston.info("Gratibot interactive report button clicked", {
    func: "feature.report.updateReportTimeRange",
    callingUser: body.user.id,
  });
  
  try {
    // Parse the action value to get the user ID and time range
    const [targetUserId, timeRange] = action.value.split(':');
    
    // Get user info to get timezone
    const userInfo = await body.client.users.info({ user: targetUserId });
    if (!userInfo.ok) {
      throw new Error(`Error retrieving user info: ${userInfo.error}`);
    }
    
    // Get the updated data
    const topMessages = await report.getTopMessagesForUser(
      targetUserId, 
      parseInt(timeRange), 
      userInfo.user.tz
    );
    const totalRecognitions = await report.getTotalRecognitionsForUser(
      targetUserId, 
      parseInt(timeRange), 
      userInfo.user.tz
    );
    
    // Create the updated blocks - now awaiting since it's async
    const blocks = await report.createUserTopMessagesBlocks(
      targetUserId,
      topMessages,
      totalRecognitions,
      parseInt(timeRange)
    );
    
    // Update the message
    await respond({
      text: `Top recognized messages for <@${targetUserId}>`,
      blocks: blocks,
    });
    
    winston.debug("interactive report button response posted to Slack", {
      func: "feature.report.updateReportTimeRange",
      callingUser: body.user.id,
      targetUser: targetUserId,
      timeRange: timeRange,
    });
  } catch (error) {
    winston.error("Error updating report", {
      func: "feature.report.updateReportTimeRange",
      callingUser: body.user.id,
      error: error.message,
    });
    
    await respond({
      text: `Something went wrong while updating the report: ${error.message}`,
      replace_original: false,
    });
  }
}
