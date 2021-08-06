# Local Development

Create a Slack app for running a development version of Gratibot:

##### Create Your App

> When using Slack manifests you **cannot** use an old slack app. You will need to create a new one.

1. Goto [api.slack.com/apps.](https://api.slack.com/apps)
2. Click 'Create New App' and choose to create an app from an app manifest.
3. Select the Slack workspace you'll run the bot in for development.
4. Copy Gratibot's app manifest from `slack_app_manifest.yml`.
5. Replace any occurences of `${botName}` with a name for your bot.
    - If you're developing in a shared workspace, consider a name like `YOUR_NAME-gratibot`.
    This will help others to identify who owns the bot.
6. Finally, confirm that the configuration looks correct and click 'Create'

##### Run Your Local Copy

1. On the **Basic Information** tab under *Settings*, scroll down to
'App-Level Tokens' and click the button to 'Generate Token and Scopes'.
Name your token 'websocket-token', and add the
scope 'connections:write'. Generate the token. Copy the ***Token*** that is
generated, we'll use it later for the bot's APP_TOKEN.
2. Go to the **Install App** tab under *Settings*. Click the button to
install the app to your workspace, and follow the provided prompts. After
installing, copy the ***Bot User OAuth Token*** value, and save it for later.
4. In your cloned copy of the repo, create a file called `.env`, it should look
something like:
    ```
    APP_TOKEN=SECRET GOES HERE
    BOT_USER_OAUTH_ACCESS_TOKEN=SECRET GOES HERE
    ```
    Replace the values after the equals sign with the values you saved before.
    There is no need for quotes. ***Make sure to not share these values, and to
    not publish them online such as by pushing them to GitHub.***

5. Now that your secrets are configured, run your local copy
of Gratibot with `docker-compose up --build`

With all of these steps complete, your bot should be running in the Slack
workspace you chose to develop for. You should now be ready to test your bot,
and progress with development.

[Bolt Docs](https://slack.dev/bolt-js/concepts)
