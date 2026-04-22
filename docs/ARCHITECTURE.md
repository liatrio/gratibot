# Architecture Guide

## System Overview

Gratibot is a Node.js application with two servers running in the same process:

- **Slack Bolt app** (socket mode) — receives and responds to Slack events over a persistent
  WebSocket connection. No inbound HTTP required from Slack.
- **Express HTTP server** — serves a health check endpoint (`/health`) and a root probe (`/`).

MongoDB (native `mongodb` driver) is the only datastore. There is no cache layer.

```
Slack API ──WebSocket──► Bolt App ──► Features ──► Services ──► MongoDB
                                                         ▲
                         Express ──► /health ────────────┘
```

## Layer Architecture

Gratibot uses a strict three-layer separation. Do not reach across layers.

### Layer 1: Features (`features/`)

Each file registers one Slack interaction with the Bolt app. Features handle:

- Registering event listeners (`app.message(...)`, `app.action(...)`, `app.command(...)`)
- Parsing incoming Slack event payloads
- Calling service functions
- Sending responses back to Slack (via `say`, `respond`, `client.chat.postMessage`, etc.)

Features contain **no business logic**. All validation, counting, and data manipulation
lives in the service layer.

| File | Slack Trigger | Capability |
|---|---|---|
| `recognize.js` | Message containing `:fistbump:` | Give recognition |
| `golden-recognize.js` | Message containing `:goldenfistbump:` | Transfer golden fistbump |
| `balance.js` | DM "balance" | Show recognition balance |
| `leaderboard.js` | DM "leaderboard" | Show top givers/receivers |
| `redeem.js` | DM "redeem" | Open reward redemption dialog |
| `deduction.js` | DM "deduction" | Admin: record a reward deduction |
| `refund.js` | DM "refund DEDUCTIONID" | Admin: refund a deduction |
| `metrics.js` | DM "metrics" | Show usage metrics |
| `report.js` | DM "report" | Generate a recognition report |
| `help.js` | DM "help" | Show help text |
| `join.js` | `channel_created` event | Auto-join newly created public channels |

All feature files are dynamically loaded at startup via `fs.readdirSync` in `app.js`.

### Layer 2: Services (`service/`)

Business logic lives here. Services are pure functions that accept parameters and return
values — they have no knowledge of Slack event shapes and no direct Slack API calls (except
via the wrappers in `service/apiwrappers.js`).

| File | Responsibility |
|---|---|
| `recognition.js` | Validate and record recognitions; golden fistbump logic |
| `balance.js` | Calculate earned/remaining balance from recognition records |
| `deduction.js` | Record and query reward deductions |
| `redeem.js` | Build redemption UI (Slack Block Kit) and process redemption requests |
| `refund.js` | Process refunds; reverse deduction records |
| `leaderboard.js` | Aggregate top givers and receivers |
| `metrics.js` | Compute recognition counts over time windows |
| `report.js` | Generate formatted recognition reports |
| `messageutils.js` | Compose and send Slack messages; Block Kit helpers |
| `apiwrappers.js` | Thin wrappers around Slack Web API calls |
| `errors.js` | Custom error types: `SlackError`, `GratitudeError` |

### Layer 3: Database (`database/`)

MongoDB collection definitions and the connection. Each collection file exports a
native Collection object used directly by services.

| File | MongoDB Collection | Contents |
|---|---|---|
| `db.js` | — | Connection singleton (`new MongoClient(config.mongo_url)`) |
| `recognitionCollection.js` | `recognitions` | All `:fistbump:` recognition records |
| `goldenRecognitionCollection.js` | `goldenrecognition` | Golden fistbump transfer history |
| `deductionCollection.js` | `deductions` | Reward redemption and deduction records |

## Database Schema

### `recognitions`

```javascript
{
  recognizer: String,     // Slack user ID of the giver
  recognizee: String,     // Slack user ID of the receiver
  timestamp: Date,        // UTC timestamp
  message: String,        // Full message text
  channel: String,        // Slack channel ID
  values: [String]        // Extracted #tags from the message
}
```

### `goldenrecognition`

```javascript
{
  recognizer: String,   // Previous holder (giver)
  recognizee: String,   // New holder (receiver)
  timestamp: Date,
  message: String,
  channel: String,
  values: [String]
}
```

### `deductions`

```javascript
{
  user: String,       // Slack ID of the redeemer
  timestamp: Date,
  refund: Boolean,    // true after a refund is issued
  value: Number,      // Cost in fistbumps
  message: String     // Human-readable redemption note
}
```

## Slack Integration Patterns

### Socket Mode

Gratibot uses Bolt's socket mode — Slack pushes events over a WebSocket rather than
calling an HTTP endpoint. This means:

- No public URL or ingress is required for the bot to receive events
- The `APP_TOKEN` (with `connections:write` scope) is required in addition to the
  `BOT_USER_OAUTH_ACCESS_TOKEN`
- The WebSocket connection is managed by Bolt automatically

### Middleware (`middleware/index.js`)

Three helper middleware functions compose Bolt listener conditions:

- `directMessage()` — returns a filter that passes only DM events
- `anyOf(...filters)` — logical OR over multiple Bolt filters
- `reactionMatches(emoji)` — returns a filter that checks reaction emoji name

Example usage in a feature:

```javascript
app.message(directMessage(), /^balance/, async ({ message, say }) => { ... });
```

### Block Kit

Interactive UI (the redemption dialog) uses Slack Block Kit. Block definitions are built
in `service/redeem.js` and `service/messageutils.js`. Refer to the
[Slack Block Kit documentation](https://api.slack.com/block-kit) when adding new UI.

### Error Handling Pattern

Feature handlers catch errors from services and respond with user-friendly Slack messages:

```javascript
try {
  await recognition.giveRecognition(/* ... */);
} catch (e) {
  if (e instanceof GratitudeError) {
    await say(e.message);
  } else {
    winston.error("Unexpected error", { func: "recognize", error: e });
    await say("Something went wrong. Please try again.");
  }
}
```

## Configuration System

All configuration is read from environment variables in `config.js` with sensible defaults.
Feature flags and limits are runtime-configurable without code changes:

| Config Key | Env Var | Default | Description |
|---|---|---|---|
| `recognizeEmoji` | `RECOGNIZE_EMOJI` | `:fistbump:` | Trigger emoji for recognition |
| `goldenRecognizeEmoji` | `GOLDEN_RECOGNIZE_EMOJI` | `:goldenfistbump:` | Golden fistbump emoji |
| `maximum` | `GRATIBOT_LIMIT` | `5` | Max recognitions a user can give per day |
| `botName` | `BOT_NAME` | `gratibot` | Bot display name |
| `slashCommand` | `SLASH_COMMAND` | `/gratibot` | Registered slash command |
| `usersExemptFromMaximum` | `EXEMPT_USERS` | (hardcoded list) | Comma-separated Slack IDs |
| `redemptionAdmins` | `REDEMPTION_ADMINS` | (hardcoded list) | Comma-separated Slack IDs |
| `mongo_url` | `MONGO_URL` | `mongodb://mongodb:27017/gratibot` | MongoDB connection string |
| `logLevel` | `LOG_LEVEL` | `info` | Winston log level |

The hardcoded defaults for user ID lists are overridden by the corresponding env var in
production. The env var takes a comma-separated string; `config.js` splits it into an array.

## Logging

Winston is configured in `winston.js` with JSON output format. The log level is controlled
by `LOG_LEVEL`. In tests, Winston is silenced via `test/setup.js`.

Log entries should include structured context:

```javascript
winston.info("Balance checked", { func: "getBalance", user: userId, balance });
winston.error("Recognition failed", { func: "giveRecognition", error: e.message });
```

## Infrastructure

See the [Deployment documentation](deployment.md) and the `infra/` directory for
Terraform modules and Terragrunt configurations targeting Liatrio's Azure subscription.
Key resources: Azure Container Instances, CosmosDB (MongoDB API), Log Analytics.
