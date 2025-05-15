const { WebClient } = require('@slack/web-api');
const winston = require('../winston');
const { directMention } = require('@slack/bolt');
const { anyOf, directMessage } = require('../middleware');

const client = new WebClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN);

// Calculate timestamp for 1 week ago
const ONE_WEEK_AGO = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

async function listClientDeliveryChannels() {
  try {
    // First, get all public channels
    const result = await client.conversations.list({
      types: 'public_channel',
      limit: 1000
    });

    // Filter channels that match 'client-*-delivery' pattern
    const clientDeliveryChannels = result.channels.filter(channel => 
      /^client-.+-delivery$/.test(channel.name)
    );

    return clientDeliveryChannels;
  } catch (error) {
    winston.error('Error fetching channels:', error);
    throw error;
  }
}

async function findTopMessageInChannel(channelId) {
  try {
    // Fetch recent messages from the channel (last 100 messages or last week, whichever comes first)
    const messages = await client.conversations.history({
      channel: channelId,
      limit: 100,
      oldest: ONE_WEEK_AGO.toString()
    });

    if (!messages.messages || messages.messages.length === 0) {
      return null;
    }

    // Find message with most reactions in the last week
    let topMessage = null;
    let maxReactions = 0;

    for (const message of messages.messages) {
      if (message.reactions && message.reactions.length > 0) {
        const totalReactions = message.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
        
        if (totalReactions > maxReactions) {
          maxReactions = totalReactions;
          topMessage = {
            ...message,
            channel: channelId,
            totalReactions
          };
        }
      }
    }


    return topMessage;
  } catch (error) {
    winston.error(`Error finding top message in channel ${channelId}:`, error);
    return null;
  }
}

async function formatMessageLink(channelId, messageTs) {
  try {
    const channelInfo = await client.conversations.info({ channel: channelId });
    const messageLink = `https://${process.env.SLACK_TEAM_DOMAIN || 'workspace'}.slack.com/archives/${channelInfo.channel.name}/p${messageTs.replace('.', '')}`;
    return messageLink;
  } catch (error) {
    winston.error('Error formatting message link:', error);
    return 'Link not available';
  }
}

async function respondToRecap({ message, client: botClient }) {
  try {
    winston.info('Recap command received', {
      user: message.user,
      channel: message.channel,
    });

    // Send initial response to acknowledge the command
    const loadingMessage = await botClient.chat.postMessage({
      channel: message.channel,
      text: 'Fetching client delivery channels and analyzing activity...',
    });

    const channels = await listClientDeliveryChannels();
    
    if (channels.length === 0) {
      await botClient.chat.postMessage({
        channel: message.channel,
        text: 'No client delivery channels found.'
      });
      return;
    }

    // Process each channel to find top messages
    const channelReports = [];
    
    for (const channel of channels) {
      const topMessage = await findTopMessageInChannel(channel.id);
      if (topMessage) {
        const messageLink = await formatMessageLink(channel.id, topMessage.ts);
        channelReports.push({
          name: channel.name,
          topMessage,
          messageLink
        });
      } else {
        channelReports.push({
          name: channel.name,
          message: 'No recent messages with reactions found.'
        });
      }
    }

    // Build the response
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 Weekly Client Delivery Recap*'
        }
      },
      {
        type: 'divider'
      }
    ];

    for (const report of channelReports) {
      if (report.topMessage) {
        const messagePreview = report.topMessage.text.length > 100 
          ? `${report.topMessage.text.substring(0, 100)}...` 
          : report.topMessage.text;
        
        blocks.push(
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*#${report.name}*\n` +
                    `Top message with ${report.topMessage.totalReactions} reactions:\n` +
                    `> ${messagePreview}`
            },
            accessory: {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Message',
                emoji: true
              },
              url: report.messageLink
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Posted by <@${report.topMessage.user}> | ${new Date(report.topMessage.ts * 1000).toLocaleDateString()}`
              }
            ]
          },
          {
            type: 'divider'
          }
        );
      } else {
        blocks.push(
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*#${report.name}*\nNo recent messages with reactions found.`
            }
          },
          {
            type: 'divider'
          }
        );
      }
    }

    // Remove the last divider
    blocks.pop();

    // Update the original loading message with the results
    await botClient.chat.update({
      channel: message.channel,
      ts: loadingMessage.ts,
      text: 'Here\'s your weekly client delivery recap!',
      blocks: blocks
    });

  } catch (error) {
    winston.error('Error in respondToRecap:', error);
    
    await botClient.chat.postMessage({
      channel: message.channel,
      text: `Sorry, I encountered an error: ${error.message}`
    });
  }
}

module.exports = function(app) {
  app.message('recap', anyOf(directMention, directMessage()), respondToRecap);
};
