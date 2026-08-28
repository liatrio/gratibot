# Development Guide

## Prerequisites

- **Node.js 24** (matches CI and the Docker base image)
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
runs `npm run lint` before each commit and fails if there are lint errors.

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

**Full stack (recommended):** runs the bot and MongoDB together via Docker Compose
with hot reload. The `--watch` flag syncs local edits into the running container and
restarts the bot automatically; changes to `package.json`, `package-lock.json`, or the
`Dockerfile` trigger a rebuild.

```bash
docker compose up --build --watch
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
| `npm test` | `mocha` + `c8` | Run tests with coverage (text + lcov) |
| `npm run lint` | `eslint` | Lint all JS files |
| `npm run lint:fix` | `eslint --fix` | Auto-fix lint issues |

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `APP_TOKEN` | — | Slack App-Level token (required, starts with `xapp-`) |
| `BOT_USER_OAUTH_ACCESS_TOKEN` | — | Slack Bot token (required, starts with `xoxb-`) |
| `MONGO_URL` | `mongodb://mongodb:27017/gratibot` | MongoDB connection string |
| `LOG_LEVEL` | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `RECOGNIZE_EMOJI` | `:fistbump:` | Emoji that triggers recognition |
| `GOLDEN_RECOGNIZE_EMOJI` | `:goldenfistbump:` | Emoji for golden recognition |
| `SELF_RECOGNIZE_EMOJI` | `:self-fistbump:` | Emoji for self recognition (public channels only, once per day) |
| `GOLDEN_RECOGNIZE_CHANNEL` | `liatrio` | Channel where golden recognition is announced |
| `REACTION_EMOJI` | `:nail_care:` | Emoji reaction that also triggers recognition |
| `GRATIBOT_LIMIT` | `5` | Max recognitions a user can give per day |
| `BOT_NAME` | `gratibot` | Bot display name |
| `SLASH_COMMAND` | `/gratibot` | Registered slash command name |
| `EXEMPT_USERS` | (hardcoded list) | Comma-separated Slack user IDs exempt from the daily limit |
| `REDEMPTION_ADMINS` | (hardcoded list) | Comma-separated Slack user IDs who can manage redemptions |
| `GOLDEN_RECOGNIZE_HOLDER` | `UE1QRFSSY` | Slack user ID of initial golden fistbump holder |
| `PORT` | `3000` | HTTP port for the health check Express server |
| `STADIUM_ENABLED` | `false` | Toggles Stadium redemption category visibility |
| `STADIUM_EMAIL_SOURCE` | `modal` | Recipient email source: required modal input or Slack profile lookup |
| `STADIUM_API_BASE_URL` | — | Stadium API v2 base URL |
| `STADIUM_CLIENT_ID` | — | OAuth client ID |
| `STADIUM_CLIENT_SECRET` | — | OAuth client secret |
| `STADIUM_STORE_NUMBER` | — | Global organization store number |
| `STADIUM_STORE_URL` | — | Stadium URL shown after successful order creation |
| `STADIUM_PAYMENT_METHOD` | — | `use_wallet_money`, `use_global_point`, or both comma-separated |
| `STADIUM_BILLING_COUNTRY` | — | Billing country sent to Stadium |
| `STADIUM_BILLING_ZIPCODE` | — | Billing postal code sent to Stadium |
| `STADIUM_FISTBUMPS_PER_UNIT` | `1` | Fistbumps in one conversion unit |
| `STADIUM_POINTS_PER_UNIT` | `1` | Stadium points issued per unit |
| `STADIUM_MIN_FISTBUMPS` | `1` | Minimum redemption amount |
| `STADIUM_MAX_FISTBUMPS` | current balance | Optional positive whole-number maximum |

### Stadium sandbox verification

Before enabling Stadium in an environment, configure all non-secret Stadium settings above. The
default `modal` email source asks the employee for their Liatrio address and does not require a
Slack app reinstall. The `slack` source reads the address from the employee's profile and requires
reinstalling the app with the `users:read.email` scope. The App Service reads
`stadium-client-id` and `stadium-client-secret` directly from Azure Key Vault using versionless
Key Vault references; Terraform does not read those values into state.

For a manual sandbox test:

1. Configure the nonprod store number, payment method, billing values, store URL, email source, and
   desired conversion ratio. Set `stadium_enabled: true` only in nonprod and apply its Terraform
   plan.
2. DM Gratibot `redeem`, choose **Redeem with Stadium**, and submit a small whole-number
   fistbump amount. In `modal` mode, enter the employee's exact `@liatrio.com` address; in `slack`
   mode, use a Slack user whose profile email ends exactly in `@liatrio.com`.
3. Confirm the deduction is present, the Stadium response is paid, and the gift appears for the
   intended employee. Open Stadium and select **Redeem Gift** to add the points to the account;
   `auto_accept_points: true` does not guarantee that this recipient action is skipped.
4. Exercise a rejected request and verify the fistbumps are restored. Exercise an uncertain
   response only in a controlled test: confirm `stadium review` lists it and resolve it with
   `stadium resolve <id> fulfilled` or `stadium resolve <id> refund` after checking Stadium.
5. Confirm the API response fields (`number` and `payment_state: paid`), fees/taxes, inventory
   behavior, and refund policy with Stadium before enabling production.

The application never retries `send_points`: a timeout, rate limit, server error, or malformed
success response holds the fistbumps and requires admin review to avoid issuing points twice.
Short-lived deduction locks use time-bounded ownership leases and can be atomically reclaimed after
expiry. An unresolved Stadium deduction is the authoritative review hold, so it cannot leave a
separate permanent lock behind. Periodic reconciliation restores interrupted local reservations,
moves stale in-flight API requests to admin review, retries undelivered admin notifications with
a leased backoff, and removes legacy review-lock records.

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

> **Direct pushes to `main` are rejected.** Always work on a branch and open a pull request.

1. **Branch from `main`** — use a descriptive branch name prefixed with the commit type: `feat/tag-filtering`, `fix/utc-offset`, `chore/bump-deps`
2. **Develop and test locally** — `npm test` and `npm run lint` before committing
3. **Open a PR** — CI runs tests, lint, and (for infra changes) terraform plan
4. **Merge to `main`** after approval
5. **Nonprod deploy** — automatic after merge; validates in the `gratibotdev` Slack app
6. **Prod deploy** — triggered by a GitHub Release event (created automatically by semantic-release) and gated by a manual approval step; see [deployment.md](deployment.md)

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
- Ensure you're on Node.js 24: `node --version`
- Run `npm ci` (not `npm install`) to get a clean, lockfile-pinned install
