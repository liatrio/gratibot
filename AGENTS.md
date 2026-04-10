# AI Agent Development Guide

This document provides essential guidance for AI agents working on the Gratibot codebase.

## Context Marker

Always begin your response with all active emoji markers, in the order they were introduced.

Format: `<marker1><marker2><marker3>\n<response>`

The marker for this instruction is: 🤖

## Project Overview

Gratibot is a Slack bot that enables peer recognition at Liatrio. Core capabilities:

- Users give `:fistbump:` emojis to recognize colleagues (up to a daily limit)
- A special `:goldenfistbump:` can only be held by one person at a time and is worth 20x
- Balances, leaderboards, and metrics are queryable via DM
- Users can redeem earned points for physical rewards; admins can issue deductions and refunds

**Stack:** Node.js 22, Slack Bolt v4 (socket mode), Express, MongoDB (via Monk), Winston logging

## Documentation Structure

- @docs/ARCHITECTURE.md — **[Architecture Guide](docs/ARCHITECTURE.md)** — Layer design, module responsibilities, Slack patterns, database schema
- @docs/DEVELOPMENT.md — **[Development Guide](docs/DEVELOPMENT.md)** — Local setup, environment variables, workflow, releases
- @docs/TESTING.md — **[Testing Guide](docs/TESTING.md)** — Mocha/Chai/Sinon patterns, mocking strategy, coverage requirements

## Essential Commands

```bash
# Run tests with code coverage
npm test

# Fix lint issues automatically (also runs as a pre-commit hook)
npm run lint-fix

# Run lint only (no fix)
npm run lint

# Run tests and lint together (run before committing)
npm run test-n-lint

# Start the bot (requires .env with Slack tokens)
npm start

# Start the full stack locally (bot + MongoDB) via Docker
docker-compose up --build
```

Minimum environment to run the bot — create a `.env` file at the project root:

```
APP_TOKEN=xapp-...
BOT_USER_OAUTH_ACCESS_TOKEN=xoxb-...
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full local setup walkthrough.

## Project Layout

```
app.js              # Entry point — registers all features, starts Bolt + Express
config.js           # All configuration sourced from environment variables
features/           # Slack event/message handlers (one file per capability)
service/            # Business logic (no Slack references; purely data operations)
database/           # Monk collection definitions and MongoDB connection
middleware/         # Bolt middleware helpers (directMessage, anyOf, reactionMatches)
test/               # Mirrors service/ and middleware/ structure
infra/              # Terraform + Terragrunt for Azure deployments
docs/               # Developer documentation
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed breakdown of each layer and module.

## Critical Requirements

### Tests With Every Implementation Change

All changes to business logic in `service/` or event handlers in `features/` must include
corresponding tests in `test/`. Write tests that cover:

- The happy path
- Key edge cases and validation failures
- Any conditional branches your change introduces

Tests live in `test/` and mirror the structure of the code they cover. See
[docs/TESTING.md](docs/TESTING.md) for patterns.

### Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add multiplier support to golden fistbump
fix: correct timezone offset in daily limit calculation
chore(deps): bump lodash to 4.18.1
docs: update local setup instructions
```

Type → release impact:
- `feat:` → minor version bump
- `fix:`, `docs:`, `refactor:`, `style:` → patch version bump
- `BREAKING CHANGE:` in footer → major version bump

Commits are linted locally via commitlint + husky. CI will reject invalid formats.

## Code Standards

### Architecture

Follow the three-layer separation strictly — do not reach across layers:

| Layer | Directory | Responsibility |
|---|---|---|
| Features | `features/` | Slack event binding only — no business logic |
| Service | `service/` | Business logic, validation, data operations |
| Database | `database/` | Collection definitions, MongoDB connection |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details on each module.

### Naming

- **Files**: kebab-case (`golden-recognize.js`)
- **Functions/variables**: camelCase (`recognizeeIdsIn`, `countGratitudeReceived`)
- **Config keys**: camelCase in `config.js`, CONSTANT_CASE for env var names

### Async

Use `async`/`await` throughout. Avoid raw `.then()` chains. Propagate errors naturally
rather than swallowing them — the feature handler is responsible for translating errors
into user-facing Slack messages.

### Logging

Use the Winston logger from `./winston`. Include context (function name, user ID, relevant
identifiers) in every log statement:

```javascript
const winston = require("./winston");
winston.info("Recognition given", { func: "myFunction", recognizer: userId, recognizee });
```

## Sensitive Areas — Use Extra Caution

### `config.js` — Production User IDs

The following lists in `config.js` contain real Slack user IDs for production users. Changes
directly affect live bot behavior for named people:

- `usersExemptFromMaximum` — users with no daily recognition limit
- `redemptionAdmins` — users who can approve/refund reward redemptions
- `initialGoldenRecognitionHolder` — seeded holder of the golden fistbump

When modifying these lists, preserve the comment with the person's name next to each ID.
These changes are safe to propose — they will not deploy without human review and workflow
approval — but be precise and deliberate.

### `infra/` — Azure Infrastructure

The `infra/` directory contains Terraform modules and Terragrunt configurations for
nonprod and prod Azure deployments. Changes here:

- Will not be applied automatically — a human must approve the GitHub Actions workflow
- Affect real cloud resources (Container Instances, CosmosDB, Log Analytics)
- Should be minimal and targeted; prefer changing only what is necessary

## Development Workflow

1. Create a feature branch from `main`
2. Implement changes with accompanying tests
3. Run `npm run test-n-lint` before committing
4. Use a conventional commit message
5. Open a PR — CI will run tests, lint, and terraform plan (for infra changes)
6. After merge to `main`, changes auto-deploy to nonprod
7. A maintainer triggers the production deployment after nonprod validation

## Review Checklist

Before considering work complete:

- [ ] Tests added or updated for all changed service/feature logic
- [ ] `npm run test-n-lint` passes locally
- [ ] Commit message follows Conventional Commits format
- [ ] No secrets, tokens, or credentials in code or comments
- [ ] `config.js` user ID entries retain their name comments
- [ ] Infra changes are deliberate and scoped to the minimum necessary
- [ ] Changes are on a feature or fix branch, not directly on `main`
