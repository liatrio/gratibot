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

        console.log(`Created channel ${testChannel.name}`);
        await slackClient.conversations.invite({
            channel: testChannel.id,
            users: config.users.sender.id,
        });
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

        await expect(page.getByText('Your current balance is: 0')).toBeVisible();
        await expect(page.getByText(`You have ${config.gratibot.recognitionLimit} left to give away today`)).toBeVisible();
    });

    test('when a fistbump is received, it should reflect in the balance', async ({page}) => {
        const {username, password} = config.users.sender;

        const signIn = new SlackSignInPage(page, config);
        await signIn.authenticate(username, password);
        const conversation = new SlackChannelConversationPage(page, config);
        await conversation.selectChannel(testChannel.name);

        await conversation.mention(config.users.receiver.username);
        await conversation.post(config.gratibot.recognitionEmoji + " for letting me send him a bunch of notifications");

        await conversation.mention(config.gratibot.username);
        await conversation.post('balance');
        await expect(page.getByText(`You have ${config.gratibot.recognitionLimit - 1} left to give away today`)).toBeVisible();
    })
});
