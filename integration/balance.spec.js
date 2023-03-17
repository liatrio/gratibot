const {test, expect} = require('@playwright/test');

const {SlackSignInPage} = require('./pages/SignInPage');
const {getConfig} = require('./config');

test.describe('balance', () => {
    let config;

    test.beforeAll(() => {
        config = getConfig();
    })

    test('when no fist bumps have been received, the user balance should be 0', async ({page}) => {
        const user = config.users.sender;
        const signInPage = new SlackSignInPage(page, config);
        await signInPage.signIn(user.username, user.password);

        await mention(page, config.gratibot.username);
        await page.getByRole('textbox').type('balance');
        await page.getByRole('button', {name: 'Send now'}).click();
        await page.getByText('Your current balance is: 0').waitFor();
    });
});

async function mention(page, username) {
    const messageTextbox =  await page.getByRole("textbox");
    await messageTextbox.waitFor();
    await messageTextbox.type(username);

    await page.getByRole("listbox").waitFor();
    await messageTextbox.press("Enter");
}
