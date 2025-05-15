const winston = require("../winston");
const { scheduleJob } = require("../service/scheduler");
const fistbumpReport = require("../service/fistbumpReport");

// map to store channel configuration
const reportConfig = new Map();

module.exports = function (app) {
  // initialize weekly report on app startup
  initializeWeeklyReport(app.client);

  // command to enable weekly reports in a channel
  // IMPORTANT: register the command WITHOUT the leading slash
  app.command("gratibot-schedule-report", handleScheduleCommand);
};

// initialize weekly reports from saved configurations
function initializeWeeklyReport(client) {
  // schedule weekly reports for Monday at 9:00 AM
  // using cron format: second minute hour day-of-month month day-of-week
  const cronSchedule = "0 0 9 * * 1";

  scheduleJob("weekly-fistbump-report", cronSchedule, async () => {
    // get all channels where reports are enabled
    const channels = Array.from(reportConfig.keys());

    for (const channelId of channels) {
      const config = reportConfig.get(channelId);
      await fistbumpReport.postFistbumpReport(
        client,
        channelId,
        config.timeRange,
      );
    }

    winston.info("weekly fistbump reports sent to all configured channels", {
      func: "feature.scheduledReport.weeklyReportJob",
      channel_count: channels.length,
    });
  });

  winston.info("weekly fistbump report scheduler initialized", {
    func: "feature.scheduledReport.initializeWeeklyReport",
  });
}

// handle the slash command to configure scheduled reports
async function handleScheduleCommand({ command, ack, respond, client }) {
  await ack();

  try {
    const { channel_id, text, user_id } = command;

    // check if user has the permission to configure reports
    const userInfo = await client.users.info({ user: user_id });
    if (!userInfo.user.is_admin) {
      await respond({
        text: "You need to be a workspace admin to configure scheduled reports.",
        response_type: "ephemeral",
      });
      return;
    }

    // parse command text for configuration
    const args = text.trim().split(/\s+/);
    const subCommand = args[0]?.toLowerCase() || "help";

    switch (subCommand) {
      case "enable": {
        // enable reports in this channel
        const timeRange = parseInt(args[1]) || 7;
        reportConfig.set(channel_id, { timeRange });

        await respond({
          text: `✅ Weekly fistbump reports are now enabled in this channel. Reports will show data for the last ${timeRange} days.`,
          response_type: "ephemeral",
        });

        winston.info("scheduled reports enabled for channel", {
          func: "feature.scheduledReport.handleScheduleCommand",
          channel: channel_id,
          time_range: timeRange,
          user: user_id,
        });
        break;
      }

      case "disable": {
        // disable reports in this channel
        reportConfig.delete(channel_id);

        await respond({
          text: "❌ Weekly fistbump reports are now disabled in this channel.",
          response_type: "ephemeral",
        });

        winston.info("scheduled reports disabled for channel", {
          func: "feature.scheduledReport.handleScheduleCommand",
          channel: channel_id,
          user: user_id,
        });
        break;
      }

      case "status": {
        // check current status
        const config = reportConfig.get(channel_id);
        const statusMessage = config
          ? `✅ Weekly fistbump reports are enabled in this channel. Reports show data for the last ${config.timeRange} days.`
          : "❌ Weekly fistbump reports are not currently enabled in this channel.";

        await respond({
          text: statusMessage,
          response_type: "ephemeral",
        });
        break;
      }

      case "preview": {
        // generate a preview report
        const previewDays = parseInt(args[1]) || 7;

        await respond({
          text: `Generating preview report for the last ${previewDays} days...`,
          response_type: "ephemeral",
        });

        await fistbumpReport.postFistbumpReport(
          client,
          channel_id,
          previewDays,
        );

        winston.info("preview report generated", {
          func: "feature.scheduledReport.handleScheduleCommand",
          channel: channel_id,
          time_range: previewDays,
          user: user_id,
        });
        break;
      }

      case "help":
      default: {
        // show help info
        await respond({
          text:
            "Available commands:\n" +
            "• `/gratibot-schedule-report enable [days]` - Enable weekly reports (defaults to 7 days)\n" +
            "• `/gratibot-schedule-report disable` - Disable weekly reports\n" +
            "• `/gratibot-schedule-report status` - Check current configuration\n" +
            "• `/gratibot-schedule-report preview [days]` - Generate a preview report\n" +
            "• `/gratibot-schedule-report help` - Show this help message",
          response_type: "ephemeral",
        });
        break;
      }
    }
  } catch (error) {
    winston.error("error handling schedule command", {
      func: "feature.scheduledReport.handleScheduleCommand",
      error: error.message,
    });

    await respond({
      text: "An error occurred while processing your command. Please try again later.",
      response_type: "ephemeral",
    });
  }
}
