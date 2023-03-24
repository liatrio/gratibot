const {WebClient} = require('@slack/web-api');
const {getConfig} = require('../config');
async function globalSetup() {
    const config = getConfig();

    const client = new WebClient(config.gratibot.botToken);
    const response = await client.conversations.create({
        name: `integration-test-${Date.now()}`,
    });
    const channel = response.channel;
    console.log(`Created channel ${channel.name}`);
    process.env.INTEGRATION_TEST_CHANNEL = JSON.stringify({id: channel.id, name: channel.name});

    await client.conversations.invite({
        channel: channel.id,
        users: config.users.sender.id,
    });
}

export default globalSetup;
