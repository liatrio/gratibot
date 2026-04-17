# Task 04 Proofs - Bolt ↔ middleware wiring integration suite

## Task Summary

This task proves that `features/` Slack handlers are correctly wired to the
real `@slack/bolt` framework — not just unit-tested with a mock app double.
A single new integration suite (`test/integration/bolt-wiring.js`) instantiates
a real Bolt `App` against a no-op custom receiver and drives events through
`app.processEvent`, covering three wiring guarantees that unit tests can't
check on their own:

- `directMessage()` middleware routes only DM events, not channel-equivalent
  ones.
- `app.message(regex, handler)` matching filters by message text as expected.
- A service rejection with `GratitudeError` propagates through the real Bolt
  listener chain to the feature's catch path and produces the expected
  user-facing `postEphemeral` message.

## What This Task Proves

- The new `NoOpReceiver` satisfies Bolt v4's `Receiver` interface (`init`,
  `start`, `stop`) without binding any socket or HTTP port, making in-process
  Bolt testing possible.
- Real Bolt listener wiring (not a mock registrations table) exercises
  `middleware/index.js#directMessage`, string/regex `app.message(...)`
  matching, and the feature-level `try/catch` that translates
  `GratitudeError` into a user-facing message.
- Bolt is imported as a real dependency in the suite (one `require` of
  `@slack/bolt`), and no test stubs the Bolt module itself.

## Evidence Summary

- `npm run test:integration` runs 18 integration specs including the three
  new wiring cases and exits 0.
- Grep on the wiring file shows a single real `@slack/bolt` require, and
  zero attempts to stub the Bolt module.
- `npm run lint` exits 0 on the full tree, confirming the new suite and the
  new receiver mock comply with the mocha-plugin / prettier rules.

## Artifact: `npm run test:integration` output

**What it proves:** The new wiring suite executes against a real Bolt app
and passes alongside the existing service-layer integration suites; the full
integration run exits 0.

**Why it matters:** This is the primary end-to-end proof that Bolt routing,
middleware, and feature error handling are correctly wired — the spec's
Unit 4 demoable end state.

**Command:**

```bash
npm run test:integration
```

**Result summary:** All 18 integration tests pass, including the three
wiring cases (`directMessage routing`, `regex / string message matcher`,
`GratitudeError propagation through recognize`). The run exits 0.

```
> gratibot@0.0.0-development test:integration
> mocha 'test/integration/**/*.js' --require test/setup.js --require test/integration/setup.js



  integration: bolt-wiring
    directMessage routing
      ✔ fires the balance handler for a DM event and not for a channel-equivalent event
    regex / string message matcher
      ✔ fires the balance handler when message text matches /balance/i and not when it does not match
    GratitudeError propagation through recognize
      ✔ posts the formatted user-facing message via postEphemeral when validateAndSendGratitude rejects with GratitudeError

  integration: service/balance
    dailyGratitudeRemaining
      ✔ should count only today's recognitions from the given user in the given timezone and subtract from the daily maximum (249ms)
    currentBalance
      ✔ should sum recognitions received, golden recognitions times twenty, minus non-refunded deductions (69ms)

  integration: service/deduction
    isBalanceSufficent
      ✔ should return true when the user's balance is at least the deduction value
      ✔ should return false when the user's balance is below the deduction value
    createDeduction
      ✔ should insert a deduction record visible via findOne
    refundDeduction
      ✔ should flip the refund flag to true on the matching record

  integration: service/leaderboard
    createLeaderboardBlocks
      ✔ should return a blocks array whose topReceivers section names the seeded top recognizee

  integration: service/metrics
    createMetricsBlocks
      ✔ should encode a chart whose daily bucket totals match the seeded recognitions

  integration: service/recognition
    getGoldenFistbumpHolder
      ✔ should return the most recent golden recognition's recognizee
    giveRecognition
      ✔ should insert a normal recognition into recognitionCollection when type is the default fistbump
      ✔ should insert a golden recognition into goldenRecognitionCollection when type is the golden emoji
    countRecognitionsReceived
      ✔ should count every recognition record whose recognizee matches the given user

  integration: service/report
    getTopMessagesForUser
      ✔ should group by message and return entries sorted by count desc with MMM D, YYYY formatted dates
      ✔ should return an empty array when the user has no recognitions in the time window
    getTotalRecognitionsForUser
      ✔ should return the total count of recognitions for the given user within the time window


  18 passing (1s)
```

## Artifact: Real `@slack/bolt` import (no module stubs)

**What it proves:** The wiring suite imports the real `@slack/bolt` package
exactly once and never stubs the Bolt module itself.

**Why it matters:** Unit 4 of the spec requires the suite to exercise the
real framework. Stubbing Bolt would defeat the purpose — only stubs at the
service/client boundary are allowed.

**Command:**

```bash
grep -n "require.*@slack/bolt" test/integration/bolt-wiring.js
grep -n 'sinon.stub(require("@slack/bolt")' test/integration/bolt-wiring.js
```

**Result summary:** Exactly one real `require("@slack/bolt")` at
`test/integration/bolt-wiring.js:18`. Zero matches for any
`sinon.stub(require("@slack/bolt"), ...)` pattern.

```
test/integration/bolt-wiring.js:18:const { App } = require("@slack/bolt");
```

```
(no matches for sinon.stub(require("@slack/bolt")))
```

## Artifact: `npm run lint` output

**What it proves:** The new `test/integration/bolt-wiring.js` and
`test/mocks/bolt-receiver.js` conform to the project's ESLint + mocha-plugin
rules (no arrow functions in `describe`/`it`, proper formatting, etc.).

**Why it matters:** CI and the husky pre-commit hook both run `npm run
lint`; failing here would block the commit.

**Command:**

```bash
npm run lint
```

**Result summary:** Lint exits 0 with no violations.

```
> gratibot@0.0.0-development lint
> eslint '*.js' 'features/**' 'service/**' 'database/**' 'middleware/**' 'test/**'
```

## Reviewer Conclusion

These artifacts show the Bolt wiring path is now exercised end-to-end by an
automated integration test: a real `@slack/bolt` App routes three
representative events through the project's `directMessage` middleware,
regex matchers, and feature-level error handlers, and all assertions pass
without stubbing Bolt itself.
