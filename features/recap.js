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

async function findTopMessages(limit = 3) {
    try {
      let allChannels = [];
      let cursor = '';
      const LIMIT = 200;
      const topMessages = [];
  
      // Get all public channels
      do {
        const result = await client.conversations.list({
          types: 'public_channel',
          limit: LIMIT,
          cursor: cursor || undefined
        });
        allChannels = allChannels.concat(result.channels);
        cursor = result.response_metadata?.next_cursor || '';
      } while (cursor);
  
      // Process each channel to find messages with fistbump reactions
      for (const channel of allChannels) {
        // Skip archived channels
        if (channel.is_archived) continue;

        // Skip channels that don't match our criteria
        const isLiatrioChannel = channel.name.startsWith('liatrio');
        
        if (!isLiatrioChannel) {
          winston.info(`Skipping channel ${channel.name} - does not match criteria`);
          continue;
        }
  
        const isInChannel = await ensureBotInChannel(channel.id);
        if (!isInChannel) {
          winston.info(`Skipping channel ${channel.name} - bot cannot join`);
          continue;
        }
  
        try {
          const messages = await client.conversations.history({
            channel: channel.id,
            limit: 100,
            oldest: ONE_MONTH_AGO.toString()
          });
  
          if (!messages.messages) continue;
  
          for (const message of messages.messages) {
            if (!message.reactions) continue;
  
            const fistbumpReaction = message.reactions.find(
              r => r.name === 'shut_up_and_take_my_fistbump'
            );
  
            if (fistbumpReaction) {
              topMessages.push({
                ...message,
                channelId: channel.id,
                channelName: channel.name,
                fistbumpCount: fistbumpReaction.count
              });
            }
          }
        } catch (error) {
          winston.error(`Error processing channel ${channel.name}:`, error);
        }
      }
  
      // Sort by fistbump count and return top N
      return topMessages
        .sort((a, b) => b.fistbumpCount - a.fistbumpCount)
        .slice(0, limit);
  
    } catch (error) {
      winston.error('Error finding top messages:', error);
      throw error;
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
  
      // Send initial header message
      await botClient.chat.postMessage({
        channel: message.channel,
        text: '🔝 *Top Fistbumped Messages This Month* :shut_up_and_take_my_fistbump:',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🔝 *Top Fistbumped Messages This Month* :shut_up_and_take_my_fistbump:'
            }
          },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: 'Finding the most fistbumped messages...'
            }]
          }
        ]
      });
  
      // Get top 3 messages across all channels
      const topMessages = await findTopMessages(3);
  
      if (topMessages.length === 0) {
        await botClient.chat.postMessage({
          channel: message.channel,
          text: 'No fistbumped messages found this month.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'No messages with :shut_up_and_take_my_fistbump: reactions found in the past month.'
              }
            }
          ]
        });
        return;
      }
  
      // Post each top message as a separate message
      for (const [index, msg] of topMessages.entries()) {
        const messageLink = await formatMessageLink(msg.channelId, msg.ts);
        const messagePreview = msg.text?.length > 200 
          ? `${msg.text.substring(0, 200)}...` 
          : msg.text || '[No text content]';
  
        await botClient.chat.postMessage({
          channel: message.channel,
          text: `#${index + 1} (${msg.fistbumpCount} 👊) in #${msg.channelName}\n${messagePreview}\n${messageLink}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*#${index + 1}* (${msg.fistbumpCount} :shut_up_and_take_my_fistbump:) in *#${msg.channelName}*`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `> ${messagePreview}`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Message',
                    emoji: true
                  },
                  url: messageLink
                }
              ]
            }
          ]
        });
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
app.message(/\b(?:recap)\b/i, anyOf(directMention, directMessage()), respondToRecap);
};