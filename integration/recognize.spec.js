const {test, expect} = require('@playwright/test');

const {SlackChannelConversationPage} = require('./pages/ChannelConversation');
const {getConfig} = require('./config');


test.describe('recognize', () => {
    const config = getConfig(),
        testChannel = JSON.parse(process.env.INTEGRATION_TEST_CHANNEL);

    test.use({ storageState: config.users.sender.storageState });

    test("when a fistbump is sent, it should be reflected in the user's balance", async ({page}) => {
        const conversation = new SlackChannelConversationPage(page, config);
        await conversation.selectChannel(testChannel.name);
        await conversation.mention(config.gratibot.username);
        await conversation.post('balance');

        await expect(page.getByText('Your current balance is: 0')).toBeVisible();
        await expect(page.getByText(`You have ${config.gratibot.recognitionLimit} left to give away today`)).toBeVisible();

        await conversation.mention(config.users.receiver.username);
        await conversation.post(config.gratibot.recognitionEmoji + " for letting me send him a bunch of notifications");

        await conversation.mention(config.gratibot.username);
        await conversation.post('balance');
        await expect(page.getByText(`You have ${config.gratibot.recognitionLimit - 1} left to give away today`)).toBeVisible();
    });

    test("when the user tries to recognize themselves, the user should receive an error", async ({page}) => {
        const conversation = new SlackChannelConversationPage(page, config);
        await conversation.selectChannel(testChannel.name);

        await conversation.mention(config.users.sender.username);
        await conversation.post(config.gratibot.recognitionEmoji + " for recognizing that you have to celebrate yourself sometimes.");

        await expect(page.getByText("Sending gratitude failed with the following error(s):")).toBeVisible();
        await expect(page.getByText("You can't recognize yourself")).toBeVisible();
    });

    test("when the recognition message is too short, the user should receive an error", async ({page}) => {
        const conversation = new SlackChannelConversationPage(page, config);
        await conversation.selectChannel(testChannel.name);

        await conversation.mention(config.users.sender.username);
        await conversation.post(config.gratibot.recognitionEmoji + "test");

        await expect(page.getByText("Your message must be at least 20 characters")).toBeVisible();
    });
});
