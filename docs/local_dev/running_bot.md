## Run Your Local Copy

1. On the **Basic Information** tab under _Settings_, scroll down to
   'App-Level Tokens' and click the button to 'Generate Token and Scopes'.
   Name your token 'websocket-token', and add the
   scope 'connections:write'. Generate the token. Copy the **_Token_** that is
   generated, we'll use it later for the bot's APP_TOKEN.
2. Go to the **Install App** tab under _Settings_. Click the button to
   install the app to your workspace, and follow the provided prompts. After
   installing, copy the **_Bot User OAuth Token_** value, and save it for later.
3. In your cloned copy of the repo, create a file called `.env`, it should look
   something like:
   `APP_TOKEN=SECRET GOES HERE BOT_USER_OAUTH_ACCESS_TOKEN=SECRET GOES HERE`
   Replace the values after the equals sign with the values you saved before.
   There is no need for quotes. **_Make sure to not share these values, and to
   not publish them online such as by pushing them to GitHub._**

4. Now that your secrets are configured, run your local copy
   of Gratibot with `docker-compose up --build`

With all of these steps complete, your bot should be running in the Slack
workspace you chose to develop for. You should now be ready to test your bot,
and progress with development.

[Bolt Docs](https://slack.dev/bolt-js/concepts)
