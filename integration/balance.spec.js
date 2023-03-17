const {test, expect} = require('@playwright/test');
const {WebClient} = require('@slack/web-api');

const {SlackSignInPage} = require('./pages/SignInPage');
const {SlackChannelConversationPage} = require('./pages/ChannelConversation');
const {getConfig} = require('./config');


test.describe('balance', () => {
    let config,
        testChannel,
        slackClient;

    test.beforeAll(async () => {
        config = getConfig();
        slackClient = new WebClient(config.gratibot.botToken);
        const response = await slackClient.conversations.create({
            name: `integration-test-balance-${Date.now()}`,
        });
        testChannel = response.channel;

        if (!response.ok) {
            console.log("oh no")
        }

        console.log(`Created channel ${testChannel.name}`);

        await slackClient.conversations.invite({
            channel: testChannel.id,
            users: "U04TFHAU3A7"
        })
    });


    test.afterAll(async () => {
        await slackClient.conversations.archive({
            channel: testChannel.id,
        });
    })

    test('when no fist bumps have been received, the user balance should be 0', async ({page}) => {
        const {username, password} = config.users.sender;

        const signIn = new SlackSignInPage(page, config);
        await signIn.authenticate(username, password);

        const conversation = new SlackChannelConversationPage(page, config);
        await conversation.selectChannel(testChannel.name);
        await conversation.mention(config.gratibot.username);
        await conversation.post('balance');

        await page.getByText('Your current balance is: 0').waitFor();
    });
});
