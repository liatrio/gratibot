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

    // Fetch recent messages from the channel (last 100 messages or last month, whichever comes first)
    const messages = await client.conversations.history({
      channel: channelId,
      limit: 100,
      oldest: ONE_MONTH_AGO.toString()
    });

    if (!messages.messages || messages.messages.length === 0) {
      winston.info(`No messages found in channel ${channelId} in the last month`);
      return null;
    }

    // Find message with most :shut_up_and_take_my_fistbump: reactions
    let topMessage = null;
    let maxFistbumps = 0;

    for (const message of messages.messages) {
      if (message.reactions?.length > 0) {
        // Find the fistbump reaction if it exists
        const fistbumpReaction = message.reactions.find(
          r => r.name === 'shut_up_and_take_my_fistbump'
        );
        
        if (fistbumpReaction && fistbumpReaction.count > maxFistbumps) {
          maxFistbumps = fistbumpReaction.count;
          topMessage = message;
          topMessage.totalFistbumps = maxFistbumps;
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
  
      // Send initial response to start a thread
      const threadMessage = await botClient.chat.postMessage({
        channel: message.channel,
        text: '📊 Monthly Client Delivery Gratitude Recap :fistbump:',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📊 *Monthly Client Delivery Gratitude Recap* :fistbump:'
            }
          },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: 'Fetching client delivery channels and analyzing activity...'
            }]
          }
        ]
      });
  
      const channels = await listClientDeliveryChannels();
      
      if (channels.length === 0) {
        await botClient.chat.update({
          channel: message.channel,
          ts: threadMessage.ts,
          text: 'No active client delivery channels found.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📊 *Monthly Client Delivery Gratitude Recap* :fistbump:'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'No active client delivery channels found with messages in the past month.'
              }
            }
          ]
        });
        return;
      }
  
      // Process each channel and post as individual thread replies
      for (const channel of channels) {
        winston.info(`Processing channel: ${channel.name}`);
        const topMessage = await findTopMessageInChannel(channel.id);
        
        if (topMessage) {
          const messageLink = await formatMessageLink(channel.id, topMessage.ts);
          const messagePreview = topMessage.text?.length > 100 
            ? `${topMessage.text.substring(0, 100)}...` 
            : topMessage.text || '[No text content]';
          
          const reactionsText = topMessage.reactions?.length > 0
            ? topMessage.reactions.map(r => `:${r.name}: ${r.count}`).join(' ')
            : 'No reactions';
  
          await botClient.chat.postMessage({
            channel: message.channel,
            thread_ts: threadMessage.ts,
            text: `*#${channel.name}*\n${messagePreview}\n${reactionsText}\n${messageLink}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*#${channel.name}*`
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: messagePreview
                }
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `${reactionsText}`
                  }
                ]
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'View',
                      emoji: true
                    },
                    url: messageLink
                  }
                ]
              }
            ]
          });
        }
      }
  
      // Update the initial message to show completion
      await botClient.chat.update({
        channel: message.channel,
        ts: threadMessage.ts,
        text: '📊 Monthly Client Delivery Gratitude Recap :fistbump:',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📊 *Monthly Client Delivery Gratitude Recap* :fistbump:'
            }
          },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `Found ${channels.length} active client delivery channels.`
            }]
          }
        ]
      });
  
    } catch (error) {
      winston.error('Error in respondToRecap:', error);
      
      // Try to update the thread message with the error if possible
      if (threadMessage?.ts) {
        await botClient.chat.update({
          channel: message.channel,
          ts: threadMessage.ts,
          text: `Sorry, I encountered an error: ${error.message}`
        });
      } else {
        // Fallback to a new message if we can't update the thread
        await botClient.chat.postMessage({
          channel: message.channel,
          text: `Sorry, I encountered an error: ${error.message}`
        });
      }
    }
  }

module.exports = function(app) {
  app.message('recap', anyOf(directMention, directMessage()), respondToRecap);
};
