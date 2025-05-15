const winston = require("../winston");
const { scheduleJob } = require("../service/scheduler");
const fistbumpReport = require("../service/fistbumpReport");
const mongoose = require("mongoose");

// in-memory fallback for when no database is available
const reportConfigMap = new Map();

// determine if mongodb is available for persistence - pure function to check connection state
const isMongoConnected = () => mongoose.connection.readyState === 1;

// schema for report configuration (only if mongodb is connected)
let ReportConfig;
if (isMongoConnected()) {
  try {
    const ReportConfigSchema = new mongoose.Schema({
      channelId: { type: String, required: true, unique: true },
      timeRange: { type: Number, default: 7 },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    // create or get the model
    ReportConfig = mongoose.models.ReportConfig || mongoose.model("ReportConfig", ReportConfigSchema);
    winston.info("mongodb available for report configuration persistence");
  } catch (error) {
    winston.error(`error setting up mongodb schema: ${error.message}`);
  }
}

module.exports = function (app) {
  // initialize weekly report on app startup
  initializeWeeklyReport(app.client);

  // register the command - ensuring we match what's in the manifest
  try {
    // get the command name from the SLASH_COMMAND environment variable with a fallback
    const slashCommandSchedule = '/gratibot-schedule-report';
    winston.info(`registering slash command handler for ${slashCommandSchedule}`);
    app.command(slashCommandSchedule, async ({ command, ack, respond, client }) => {
      // acknowledge receipt of the command immediately
      try {
        await ack();
        winston.info("command acknowledged", { command_text: command.text });
        await handleScheduleCommand({ command, ack: () => {}, respond, client });
      } catch (error) {
        winston.error(`error handling command: ${error.message}`, { stack: error.stack });
        // try to respond even after error
        try {
          await respond({ text: `An error occurred: ${error.message}`, response_type: "ephemeral" });
        } catch (respondError) {
          winston.error(`failed to respond with error: ${respondError.message}`);
        }
      }
    });
    winston.info("slash command handler registered successfully");
  } catch (error) {
    winston.error(`failed to register command handler: ${error.message}`, { stack: error.stack });
  }
};

// initialize weekly reports from saved configurations
async function initializeWeeklyReport(client) {
  // schedule weekly reports for Monday at 9:00 AM
  // using cron format: second minute hour day-of-month month day-of-week
  const cronSchedule = "0 0 9 * * 1";

  try {
    // load configurations based on available storage
    let configs = [];
    
    if (isMongoConnected() && ReportConfig) {
      // load from mongodb if available
      configs = await ReportConfig.find({});
      winston.info("loaded report configurations from database", {
        func: "feature.scheduledReport.initializeWeeklyReport",
        config_count: configs.length,
      });
    } else {
      // use in-memory configs
      configs = Array.from(reportConfigMap.entries()).map(([channelId, config]) => ({
        channelId,
        timeRange: config.timeRange,
      }));
      winston.info("using in-memory report configurations", {
        func: "feature.scheduledReport.initializeWeeklyReport",
        config_count: configs.length,
      });
    }

    // schedule the weekly job
    scheduleJob("weekly-fistbump-report", cronSchedule, async () => {
      // get current configurations
      let currentConfigs = [];
      
      if (isMongoConnected() && ReportConfig) {
        currentConfigs = await ReportConfig.find({});
      } else {
        currentConfigs = Array.from(reportConfigMap.entries()).map(([channelId, config]) => ({
          channelId,
          timeRange: config.timeRange,
        }));
      }
      
      let successCount = 0;
      let failCount = 0;

      // use Promise.allSettled to handle errors for individual channels
      const results = await Promise.allSettled(
        currentConfigs.map(async (config) => {
          try {
            await fistbumpReport.postFistbumpReport(
              client,
              config.channelId,
              config.timeRange,
            );
            return { channelId: config.channelId, success: true };
          } catch (error) {
            winston.error("error sending report to channel", {
              func: "feature.scheduledReport.weeklyReportJob",
              channel: config.channelId,
              error: error.message,
            });
            return { channelId: config.channelId, success: false, error: error.message };
          }
        })
      );

      // count successes and failures
      results.forEach(result => {
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      });

      winston.info("weekly fistbump reports processing completed", {
        func: "feature.scheduledReport.weeklyReportJob",
        success_count: successCount,
        fail_count: failCount,
        total_channels: currentConfigs.length,
      });
    });

    winston.info("weekly fistbump report scheduler initialized", {
      func: "feature.scheduledReport.initializeWeeklyReport",
    });
  } catch (error) {
    winston.error("failed to initialize weekly report scheduler", {
      func: "feature.scheduledReport.initializeWeeklyReport",
      error: error.message,
    });
  }
}

// pure function to determine if a user has permission to configure reports
const hasReportPermission = (userInfo, permissionLevel = 'all') => {
  // different permission strategies
  const permissionStrategies = {
    // only workspace admins can configure
    'admin': () => userInfo.user?.is_admin === true,
    // anyone can configure (useful for testing and development)
    'all': () => true,
    // specific users can configure (from environment variable)
    'specific': () => {
      const allowedUsers = (process.env.REPORT_ADMINS || '').split(',').map(id => id.trim());
      return allowedUsers.includes(userInfo.user?.id);
    }
  };
  
  // get the strategy function or default to 'all'
  const checkPermission = permissionStrategies[permissionLevel] || permissionStrategies.all;
  
  // execute the permission check
  return checkPermission();
};

// handle the slash command to configure scheduled reports
async function handleScheduleCommand({ command, ack, respond, client }) {
  await ack();

  try {
    const { channel_id, text, user_id } = command;

    // check if user has the permission to configure reports using our pure function
    const userInfo = await client.users.info({ user: user_id });
    
    // get permission level from environment or use default 'all' during development
    const permissionLevel = process.env.REPORT_PERMISSION_LEVEL || 'all';
    
    if (!hasReportPermission(userInfo, permissionLevel)) {
      await respond({
        text: "You don't have permission to configure scheduled reports. Contact your workspace admin for help.",
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
        
        // save configuration based on available storage
        if (isMongoConnected() && ReportConfig) {
          // save to database if available
          await ReportConfig.findOneAndUpdate(
            { channelId: channel_id },
            { channelId: channel_id, timeRange, updatedAt: new Date() },
            { upsert: true, new: true }
          );
        } else {
          // save to in-memory map as fallback
          reportConfigMap.set(channel_id, { timeRange });
          winston.info("using in-memory storage for report config");
        }

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
        // disable reports in this channel based on available storage
        if (isMongoConnected() && ReportConfig) {
          // remove from database if available
          await ReportConfig.deleteOne({ channelId: channel_id });
        } else {
          // remove from in-memory map as fallback
          reportConfigMap.delete(channel_id);
        }

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
        // check current status based on available storage
        let config = null;
        
        if (isMongoConnected() && ReportConfig) {
          // check database if available
          config = await ReportConfig.findOne({ channelId: channel_id });
        } else {
          // check in-memory map as fallback
          config = reportConfigMap.get(channel_id);
        }
        
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

        try {
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
        } catch (error) {
          winston.error("error generating preview report", {
            func: "feature.scheduledReport.handleScheduleCommand",
            channel: channel_id,
            error: error.message,
          });
          
          await respond({
            text: `Failed to generate report: ${error.message}`,
            response_type: "ephemeral",
          });
        }
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
