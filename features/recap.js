const { WebClient } = require('@slack/web-api');
const winston = require('../winston');
const { directMention } = require('@slack/bolt');
const { anyOf, directMessage } = require('../middleware');

const client = new WebClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN);

// Calculate timestamp for 1 month ago
const ONE_MONTH_AGO = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

async function listClientDeliveryChannels() {
    try {
      let allChannels = [];
      let cursor = '';
      const LIMIT = 200; // Recommended batch size
  
      // Keep fetching until there are no more pages
      do {
        const result = await client.conversations.list({
          types: 'public_channel',
          limit: LIMIT,
          cursor: cursor || undefined // Only include cursor if it has a value
        });
  
        // Add the current page of channels to our collection
        allChannels = allChannels.concat(result.channels);
  
        // Get the next cursor for pagination
        cursor = result.response_metadata?.next_cursor || '';
  
      } while (cursor); // Continue until there's no more pages
  
      // Debug: Log all channels for inspection
      winston.info(`Found ${allChannels.length} total channels in workspace`);
  
      // Filter channels that match 'client-*-delivery' pattern and are not archived
      const clientDeliveryChannels = allChannels.filter(channel => {
        const matchesPattern = /^client-.+-delivery$/.test(channel.name);
        winston.info(`Channel ${channel.name}: matchesPattern=${matchesPattern}, is_archived=${channel.is_archived}`);
        return matchesPattern && !channel.is_archived;
      });
  
      winston.info(`Found ${clientDeliveryChannels.length} active client delivery channels: ${clientDeliveryChannels.map(c => c.name).join(', ')}`);
      return clientDeliveryChannels;
    } catch (error) {
      winston.error('Error fetching channels:', error);
      throw error;
    }
  }

async function ensureBotInChannel(channelId) {
  try {
    // First try to join the channel
    await client.conversations.join({ channel: channelId });
    return true;
  } catch (error) {
    // Handle expected error cases
    if (error.data?.error === 'already_in_channel') {
      return true; // Already in channel
    }
    if (error.data?.error === 'is_archived') {
      winston.warn(`Skipping archived channel ${channelId}`);
      return false;
    }
    winston.error(`Error joining channel ${channelId}:`, error);
    return false;
  }
}

async function findTopMessageInChannel(channelId) {
  try {
    // Ensure bot is in the channel before trying to read history
    const isInChannel = await ensureBotInChannel(channelId);
    if (!isInChannel) {
      winston.warn(`Skipping channel ${channelId} - bot cannot join`);
      return null;
    }

    // Fetch recent messages from the channel (last 100 messages or last week, whichever comes first)
    const messages = await client.conversations.history({
      channel: channelId,
      limit: 100,
      oldest: ONE_MONTH_AGO.toString()
    });

    if (!messages.messages || messages.messages.length === 0) {
      return null;
    }

    // Find message with most reactions in the last week
    let topMessage = null;
    let maxReactions = 0;

    for (const message of messages.messages) {
      if (message.reactions?.length > 0) {
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
    winston.info(`Processing ${channels.length} channels: ${channels.map(c => c.name).join(', ')}`);
    
    for (const channel of channels) {
      winston.info(`Processing channel: ${channel.name}`);
      const topMessage = await findTopMessageInChannel(channel.id);
      winston.info(`Channel ${channel.name} - found message:`, topMessage ? 'Yes' : 'No');
      if (topMessage) {
        const messageLink = await formatMessageLink(channel.id, topMessage.ts);
        channelReports.push({
          name: channel.name,
          topMessage,
          messageLink
        });
      }
      // Skip channels without messages in the timeframe
    }
    
    if (channelReports.length === 0) {
      await botClient.chat.update({
        channel: message.channel,
        ts: loadingMessage.ts,
        text: 'No active client delivery channels found with messages in the past week.'
      });
      return;
    }

    // Process channel reports in chunks to respect Slack's block limit (50 blocks per message)
    const CHUNK_SIZE = 8; // Each channel takes ~6 blocks, so 8 channels per message max
    const chunks = [];
    
    for (let i = 0; i < channelReports.length; i += CHUNK_SIZE) {
      chunks.push(channelReports.slice(i, i + CHUNK_SIZE));
    }

    // Send each chunk as a separate message
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks.length - 1;
      
      // Build the response blocks for this chunk
      const blocks = [];
      
      // Add header only for first chunk
      if (isFirstChunk) {
        blocks.push(
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*📊 Monthly Client Delivery Hype Recap (Most reacted messages) *'
            }
          },
          {
            type: 'divider'
          }
        );
      }

      // Add channel reports for this chunk (we only include channels with messages)
      for (const report of chunk) {
        const messagePreview = report.topMessage.text?.length > 100 
          ? `${report.topMessage.text.substring(0, 100)}...` 
          : report.topMessage.text || '[No text content]';
        
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
                text: 'View',
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
      }

      // Remove the last divider
      if (blocks.length > 0) {
        blocks.pop();
      }

      // Add a "Part X of Y" indicator if there are multiple chunks
      if (chunks.length > 1) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Part ${i + 1} of ${chunks.length}`
            }
          ]
        });
      }

      // For the first chunk, update the loading message
      if (isFirstChunk) {
        await botClient.chat.update({
          channel: message.channel,
          ts: loadingMessage.ts,
          text: 'Here\'s your weekly client delivery recap!',
          blocks: blocks
        });
      } else {
        // For subsequent chunks, send as new messages
        await botClient.chat.postMessage({
          channel: message.channel,
          text: `Weekly Client Delivery Recap (continued)`,
          blocks: blocks
        });
      }
    }

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
