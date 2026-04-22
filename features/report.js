const report = require("../service/report");
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { directMessage, anyOf } = require("../middleware");
const { respondToUser } = require("../service/messageutils");

module.exports = function (app) {
  // Handle direct "report" command
  app.message(
    /^report(?:\s+<@([a-zA-Z0-9]+)>)?(?:\s+(\d+))?$/i,
    anyOf(directMessage(), directMention),
    respondToReport,
  );

  // Handle button clicks for different time ranges
  app.action(/user-top-messages-\d+/, updateReportTimeRange);
};

async function respondToReport({ message, client }) {
  winston.info("@gratibot report Called", {
    func: "feature.report.respondToReport",
    callingUser: message.user,
    slackMessage: message.text,
  });
  const mentionMatch = message.text.match(/<@([a-zA-Z0-9]+)>/i);
  const targetUserId = mentionMatch ? mentionMatch[1] : message.user;
  const timeRangeMatch = message.text.match(/\s+(\d+)\s*$/i);

  try {
    const userInfo = await client.users.info({ user: targetUserId });
    if (!userInfo.ok) {
      throw new Error(`Error retrieving user info: ${userInfo.error}`);
    }

    const timeRange = timeRangeMatch ? parseInt(timeRangeMatch[1]) : 180;

    const topMessages = await report.getTopMessagesForUser(
      targetUserId,
      timeRange,
      userInfo.user.tz,
    );
    const totalRecognitions = await report.getTotalRecognitionsForUser(
      targetUserId,
      timeRange,
      userInfo.user.tz,
    );

    const blocks = await report.createUserTopMessagesBlocks(
      targetUserId,
      topMessages,
      totalRecognitions,
      timeRange,
    );

    await respondToUser(client, message, {
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

    await respondToUser(client, message, {
      text: "An unexpected error occurred while generating the report. Please try again later.",
    });
  }
}

async function updateReportTimeRange({ ack, body, client, action, respond }) {
  await ack();
  winston.info("Gratibot interactive report button clicked", {
    func: "feature.report.updateReportTimeRange",
    callingUser: body.user.id,
  });

  try {
    const [targetUserId, timeRange] = action.value.split(":");

    const userInfo = await client.users.info({ user: targetUserId });
    if (!userInfo.ok) {
      throw new Error(`Error retrieving user info: ${userInfo.error}`);
    }

    const topMessages = await report.getTopMessagesForUser(
      targetUserId,
      parseInt(timeRange),
      userInfo.user.tz,
    );
    const totalRecognitions = await report.getTotalRecognitionsForUser(
      targetUserId,
      parseInt(timeRange),
      userInfo.user.tz,
    );

    const blocks = await report.createUserTopMessagesBlocks(
      targetUserId,
      topMessages,
      totalRecognitions,
      parseInt(timeRange),
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
      text: "Something went wrong while updating the report. Please try again later.",
      replace_original: false,
    });
  }
}
