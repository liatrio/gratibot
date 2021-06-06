
# Gratibot

[![prod](https://github.com/liatrio/gratibot-rewrite/actions/workflows/prod.yaml/badge.svg)](https://github.com/liatrio/gratibot-rewrite/actions/workflows/release.yaml)
[![nonprod](https://github.com/liatrio/gratibot-rewrite/actions/workflows/nonprod.yaml/badge.svg)](https://github.com/liatrio/gratibot-rewrite/actions/workflows/nonprod.yaml)
[![codecov](https://codecov.io/gh/liatrio/gratibot/branch/main/graph/badge.svg)](https://codecov.io/gh/liatrio/gratibot)

Gratibot is a Slack bot for recognizing the accomplishments of friends and
colleagues. Read more in [Liatrio's blog post about Gratibot.](https://www.liatrio.com/blog/gratibot-chatbot)

---

### Roadmap

- [x] Deploy on Azure
- [ ] Implement Functional Testing
- [ ] Refactor Logic to Service Module
- [ ] Redeem Fistbumps Through Gratibot
- [x] Replace Botkit with Bolt

---

### Deployment

Gratibot is deployed in Liatrio's Azure environments using GitHub Actions and
Terraform. After a change passes CI checks and is approved by reviewers, it can
be merged into main.

Merging to main will automatically kick off a deployment to Gratibot's
non-prod environment, which corresponds to the 'gratibotdev' bot inside of
Liatrio's Slack workspace.

After validating in non-prod, a new release can be initiated by pushing a
[Semantic Version](https://semver.org/) tag to GitHub. This will initiate the
production workflow which will require a code owner to review the deployment's
Terraform plan. After the workflow is approved, it will automatically deploy
to Gratibot's prod environment, which corresponds to the 'gratibot' bot inside
of Liatrio's Slack workspace.

---

### Local Development

Create a Slack app for running a development version of Gratibot:

##### Create Your App

1. Goto [api.slack.com/apps.](https://api.slack.com/apps)
2. Click 'Create New App' and pick a name for your app.
    - If you're developing in a shared workspace, consider a name like `${your_name}-bot`.
    This will help others to identify who owns the bot.
3. Select the Slack workspace you'll run the bot in for development.
4. Click the 'Create App' button.

##### Run Your Local Copy

1. Slack won't let you install the app without any permissions, so
give your app a very basic permission so we have the ability to install it.
We'll need to re-install the app later when we add new permission scopes.
    1. On the sidebar, select the **OAuth & Permission** tab, under *Features*
    2. On this tab, scroll to the 'Scopes'.
    Add the 'Bot Token Scope', `app_mentions:read`.
    3. Go to the tab **Install App** under *Settings*. Click through the
    required prompts to install the app.
2. On the **Basic Information** tab under *Settings*, find your
'App Credentials'. Show the ***Signing Secret*** value, and save it for later.
3. Return to the **Install App** tab. Copy the
***Bot User OAuth Token*** value, and save it for later.
4. In your cloned copy of the repo, create a file called `.env`, it should look
something like:
    ```
    SIGNING_SECRET=SECRET GOES HERE
    BOT_USER_OAUTH_ACCESS_TOKEN=SECRET GOES HERE
    ```
    Replace the values after the equals sign with the values you saved before.
    There is no need for quotes. ***Make sure to not share these values, and to
    not publish them online such as by pushing them to GitHub.***

5. Now that your secrets are configured, run your local copy
of Gratibot with `docker-compose up`
6. Forward the local application to a public hostname with `ngrok http 3000`,
be sure to note the hostname that ngrok generates as we'll need it later.

##### Finishing Slack App Configuration

1. Now that the bot is running, we can configure Slack to send specific
events to it, which will then trigger bot actions. In the
**Interactivity & Shortcuts** tab under *Features* enable 'Interactivity'
and set the 'Request URL' to `https://${NGROK_HOSTNAME}/slack/events`
2. On the **Event Subscriptions** tab under *Features* enable 'Events', and set
the 'Request URL' to `https://${NGROK_HOSTNAME}/slack/events`
3. On the same tab, we'll need to 'Subscribe to Bot Events'. Existing Gratibot
functionality requires the following:
    - `app_mention`
    - `message.channels`
    - `message.groups`
    - `message.im`
    - `message.mpim`
    - `reaction_added`

    If you're developing new functionality, you may need additional event
    subscriptions.
4. Return to the **OAuth & Permissions** tab, as we'll need to add a few more
scopes to the app. Slack will automatically add scopes required for the events
we subscribed to. In addition to those, we'll also need to add the following
'Bot Token Scopes':
    - `chat:write`
    - `im:write`
    - `users:read`

    Once again, if you're developing new functionality, you may need additional
    scopes to be granted.
5. Reinstall the app by clicking the 'Reinstall to Workspace' 'button at the
top of this tab. You'll need to reinstall the app any time you request
additional scopes.


With all of these steps complete, your bot should be running in the Slack
workspace you chose to develop for. You should now be ready to test your bot,
and progress with development.

[Botkit Docs](https://botkit.ai/docs/v4)
