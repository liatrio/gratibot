const {WebClient} = require('@slack/web-api');
const {getConfig} = require('../config');

async function globalTeardown() {
    const config = getConfig();
    const client = new WebClient(config.gratibot.botToken);
    const channel = JSON.parse(process.env.INTEGRATION_TEST_CHANNEL);

    await client.conversations.archive({
        channel: channel.id,
    });

    delete process.env.INTEGRATION_TEST_CHANNEL;
}

export default globalTeardown;
