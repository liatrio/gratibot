
# Gratibot

[![Prod](https://github.com/liatrio/gratibot/actions/workflows/apply-prod.yml/badge.svg)](https://github.com/liatrio/gratibot/actions/workflows/apply-prod.yml)
[![Release](https://github.com/liatrio/gratibot/actions/workflows/release.yml/badge.svg)](https://github.com/liatrio/gratibot/actions/workflows/release.yml)
[![prod](https://github.com/liatrio/gratibot-rewrite/actions/workflows/prod.yaml/badge.svg)](https://github.com/liatrio/gratibot-rewrite/actions/workflows/release.yaml)

[![codecov](https://codecov.io/gh/liatrio/gratibot/branch/main/graph/badge.svg)](https://codecov.io/gh/liatrio/gratibot)

Gratibot is a Slack bot for recognizing the accomplishments of friends and
colleagues. Read more in [Liatrio's blog post about Gratibot.](https://www.liatrio.com/blog/gratibot-chatbot)

---

### Roadmap

- [x] Deploy on Azure
- [ ] Implement Functional Testing
- [ ] Refactor Logic to Service Module
- [x] Redeem Fistbumps Through Gratibot
- [x] Replace Botkit with Bolt

---

### Contributing

Gratibot leverages [Convential Commits](https://www.conventionalcommits.org/en/v1.0.0/)
to drive version bumps and mantain a clean commit history. Things worth noting:

- Commits will be linted locally to enforce valid conventional commits
  - [husky](https://typicode.github.io/husky/#/)
  - [commitlint](https://github.com/conventional-changelog/commitlint)
- Releases will be published and maintained by [semantic-release](https://github.com/semantic-release/semantic-release)
  - Preview your release locally with `npm run semantic-release --dry-run`(_You'll need a GITHUB_TOKEN_)

---

### Deployment

Gratibot is deployed in Liatrio's Azure environments using GitHub Actions and
Terraform. After a change passes CI checks and is approved by reviewers, it can
be merged into main.

Commits to main will kickoff the following steps:

1. Build & Publish a new Docker image using the current Git ref as a tag
2. Apply the new image and any infrastructure changes to our nonprod Azure subscription
3. Upon manual review from maintainers, a new Release will be generated and published to GitHub

New GitHub Releases will trigger our workflow to deploy changes to our prod Azure subscription


---

### Local Development

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


### Useful Mongo commands

list databases. `gratibot` is the database being used for this project.

```
db.adminCommand( { listDatabases: 1 } )
```

switch to `gratibot` db.

```
use gratibot
```

list collections (in the current db)

```
db.getCollectionNames()
```

list all items in a collections

```
db.COLLECTION_NAME.find()
```

find item in collection based on index value

```
db.COLLECTION_NAME.find({KEY: VALUE})
```

### Utility Commands

run tests

```
npm test
```

run lint fix

```
npm run lint-fix
```

