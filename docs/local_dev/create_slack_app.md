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
