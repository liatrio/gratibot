const {test: setup} = require('@playwright/test');

const {getConfig} = require('../config');
const {SlackSignInPage} = require('../pages/SignInPage');

setup('authenticate sender', async ({ page }) => {
    const config = getConfig();

    const {email, password, storageState} = config.users.sender;
    const signIn = new SlackSignInPage(page, config);
    await signIn.authenticate(email, password);

    await page.context().storageState({ path: storageState });
})