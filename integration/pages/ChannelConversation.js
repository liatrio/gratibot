exports.SlackChannelConversationPage = class SlackChannelConversationPage {
    constructor(page, config) {
        this.page = page;
        this.config = config;
    }

    async post(message) {
        await this.page.getByRole('textbox').type(message);
        await this.page.getByRole('button', {name: 'Send now'}).click();
    }

    async selectChannel(name) {
        await this.page.goto("https://app.slack.com/client");
        await this.page.getByText(name, { exact: true }).click();
    }

    async mention(username) {
        const messageBox = await this.page.getByRole('textbox');
        await messageBox.waitFor();
        await messageBox.type(username);

        await this.page.getByRole('listbox').waitFor();
        await messageBox.press('Enter');
    }
}