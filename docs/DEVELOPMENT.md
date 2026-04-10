# Development Guide

## Prerequisites

- **Node.js 22** (matches the Docker base image: `node:22-alpine`)
- **Docker & Docker Compose** — for running the full local stack
- **A Slack workspace** where you have permission to install apps

## Local Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/liatrio/gratibot.git
cd gratibot
npm install
```

Husky git hooks are installed automatically as part of `npm install`. The pre-commit hook
runs `npm run lint-fix` before each commit.

### 2. Create a Development Slack App

You need your own Slack app to run a local copy of the bot without affecting the shared
nonprod or prod bots.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From an app manifest** and select your development workspace
3. Paste the contents of `slack_app_manifest.yml`
4. Replace every occurrence of `${botName}` with a unique name (e.g., `yourname-gratibot`)
5. Confirm and click **Create**

> You must create a **new** app — manifests cannot be applied to existing apps.

See [local_dev/create_slack_app.md](local_dev/create_slack_app.md) for a detailed walkthrough.

### 3. Gather Slack Tokens

**App-Level Token (APP_TOKEN):**
1. In your app settings, go to **Settings → Basic Information**
2. Scroll to **App-Level Tokens** and click **Generate Token and Scopes**
3. Name it `websocket-token`, add the scope `connections:write`, and generate
4. Copy the token (starts with `xapp-`)

**Bot Token (BOT_USER_OAUTH_ACCESS_TOKEN):**
1. Go to **Settings → Install App**
2. Install the app to your workspace
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 4. Configure Environment Variables

Create a `.env` file at the project root:

```
APP_TOKEN=xapp-...
BOT_USER_OAUTH_ACCESS_TOKEN=xoxb-...
```

Do not commit this file. It is already listed in `.gitignore`.

Additional variables you may want to set locally:

```
LOG_LEVEL=debug
GRATIBOT_LIMIT=10
MONGO_URL=mongodb://localhost:27017/gratibot
```

See the [Environment Variables Reference](#environment-variables-reference) below for all options.

### 5. Start the Bot

**Full stack (recommended):** runs the bot and MongoDB together via Docker Compose:

```bash
docker-compose up --build
```

**Bot only** (requires a running MongoDB at `MONGO_URL`):

```bash
npm start
```

Once running, the bot should appear online in your Slack workspace. You can test it by
DMing the bot with `balance` or `help`.

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `npm start` | `node app.js` | Start the bot |
| `npm test` | `mocha` + `nyc` | Run tests with coverage |
| `npm run test:ci` | `npm ci && npm test && report-coverage` | Full CI test pipeline |
| `npm run lint` | `eslint` | Lint all JS files |
| `npm run lint-fix` | `eslint --fix` | Auto-fix lint issues |
| `npm run test-n-lint` | `npm test && npm run lint` | Tests + lint (use before committing) |
| `npm run report-coverage` | `nyc report --reporter=text-lcov` | Generate LCOV coverage file |

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `APP_TOKEN` | — | Slack App-Level token (required, starts with `xapp-`) |
| `BOT_USER_OAUTH_ACCESS_TOKEN` | — | Slack Bot token (required, starts with `xoxb-`) |
| `MONGO_URL` | `mongodb://mongodb:27017/gratibot` | MongoDB connection string |
| `LOG_LEVEL` | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `RECOGNIZE_EMOJI` | `:fistbump:` | Emoji that triggers recognition |
| `GOLDEN_RECOGNIZE_EMOJI` | `:goldenfistbump:` | Emoji for golden recognition |
| `GOLDEN_RECOGNIZE_CHANNEL` | `liatrio` | Channel where golden recognition is announced |
| `REACTION_EMOJI` | `:nail_care:` | Emoji reaction that also triggers recognition |
| `GRATIBOT_LIMIT` | `5` | Max recognitions a user can give per day |
| `BOT_NAME` | `gratibot` | Bot display name |
| `SLASH_COMMAND` | `/gratibot` | Registered slash command name |
| `EXEMPT_USERS` | (hardcoded list) | Comma-separated Slack user IDs exempt from the daily limit |
| `REDEMPTION_ADMINS` | (hardcoded list) | Comma-separated Slack user IDs who can manage redemptions |
| `GOLDEN_RECOGNIZE_HOLDER` | `UE1QRFSSY` | Slack user ID of initial golden fistbump holder |
| `PORT` | `3000` | HTTP port for the health check Express server |

## Conventional Commits

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/).
This is enforced locally by commitlint + husky and drives automated versioning via semantic-release.

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Common types:**

| Type | When to use | Release impact |
|---|---|---|
| `feat` | New user-facing feature | Minor bump |
| `fix` | Bug fix | Patch bump |
| `chore` | Dependency updates, tooling changes | No release |
| `docs` | Documentation only | Patch bump |
| `refactor` | Code restructure without behavior change | Patch bump |
| `style` | Formatting, whitespace | Patch bump |
| `test` | Adding or updating tests | No release |
| `ci` | CI/CD workflow changes | No release |

Breaking changes: add `BREAKING CHANGE: <description>` in the commit footer (triggers major bump).

**Examples:**

```
feat: add tag filtering to leaderboard
fix: correct UTC offset in daily recognition window
chore(deps): bump @slack/bolt to 4.2.0
test: add edge cases for maximum recognition validation
```

## Git Workflow

1. **Branch from `main`** — use a descriptive branch name: `feat/tag-filtering`, `fix/utc-offset`
2. **Develop and test locally** — `npm run test-n-lint` before committing
3. **Open a PR** — CI runs tests, lint, and (for infra changes) terraform plan
4. **Merge to `main`** after approval
5. **Nonprod deploy** — automatic after merge; validates in the `gratibotdev` Slack app
6. **Prod deploy** — triggered manually after nonprod validation; see [deployment.md](deployment.md)

## Useful MongoDB Commands

Connect to the running MongoDB container:

```bash
docker exec -it gratibot-mongodb-1 mongosh
```

Common queries:

```javascript
// List databases
db.adminCommand({ listDatabases: 1 })

// Switch to gratibot database
use gratibot

// List collections
db.getCollectionNames()

// View all recognitions
db.recognitions.find()

// Find recognitions for a specific user
db.recognitions.find({ recognizee: "SLACK_USER_ID" })

// View deductions
db.deductions.find()
```

## Troubleshooting

**Bot doesn't come online:**
- Check that `APP_TOKEN` and `BOT_USER_OAUTH_ACCESS_TOKEN` are set correctly in `.env`
- Confirm the app is installed to the workspace (Settings → Install App)
- Check `LOG_LEVEL=debug` output for connection errors

**Recognition not being recorded:**
- Confirm the bot has been invited to the channel (`/invite @yourname-gratibot`)
- Check that your message contains the exact emoji configured in `RECOGNIZE_EMOJI`
- Check MongoDB to verify the record was written: `db.recognitions.find()`

**Tests fail locally but pass in CI:**
- Ensure you're on Node.js 22: `node --version`
- Run `npm ci` (not `npm install`) to get a clean, lockfile-pinned install
