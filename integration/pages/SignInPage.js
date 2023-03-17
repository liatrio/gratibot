exports.SlackSignInPage = class SlackSignInPage {
    constructor(page, config) {
        this.page = page;
        this.config = config;
    }

    async signIn(username, password) {
        await this.page.goto(`${this.config.slackBaseUrl}/sign_in_with_password`);
        await this.page
            .getByRole('textbox', {name: 'email'})
            .fill(username);
        await this.page
            .getByRole('textbox', {name: 'password'})
            .fill(password);

        await this.page.getByRole('button', {name: 'Sign In', exact: true}).click();
        await this.page.getByRole('textbox').waitFor();
    }
}

