# 04-tasks-feature-and-integration-test-coverage

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `test/features/balance.js` | NEW — unit test for `features/balance.js`; covers happy path and `users.info` error branch. |
| `test/features/deduction.js` | NEW — covers `users.info` failure, admin guard, argument-validation branch, insufficient-balance branch, happy path. |
| `test/features/golden-recognize.js` | NEW — covers happy path (validate + notify + channel broadcast) and `GratitudeError`/`SlackError`/generic error branches. |
| `test/features/join.js` | NEW — covers the `channel_created` happy path and the `SlackError`/generic error branches. |
| `test/features/leaderboard.js` | NEW — covers `respondToLeaderboard` and the `leaderboard-\d+` action handler (`updateLeaderboardResponse`). |
| `test/features/metrics.js` | NEW — covers `respondToMetrics` and the `metrics-\d+` action handler (`updateMetricsResponse`). |
| `test/features/redeem.js` | NEW — covers the `redeem` message handler and the `redeem` action handler, including "Liatrio Store" branch and insufficient-balance branch. |
| `test/features/refund.js` | NEW — covers the delegation to `refund.respondToRefund` (admin vs. non-admin branches via service). |
| `test/features/report.js` | NEW — covers `respondToReport` (target-user extraction, time-range parsing, `users.info` error, generic error) and `updateReportTimeRange`. |
| `test/features/recognize.js` | EXTEND — add cases for `SlackError` branch (line 68), generic-error branch (lines 72–73), and full reaction handler (lines 90–175): happy path, `recognizeEmoji` absent short-circuit, error branches, and `messageReactedTo` SlackError throw. |
| `test/service/report.js` | NEW — unit tests for `getTopMessagesForUser`, `getTotalRecognitionsForUser`, and `createUserTopMessagesBlocks`, including empty/error paths. Stubs `recognitionCollection.aggregate` and `countDocuments`. |
| `test/integration/service/leaderboard.js` | NEW — integration suite for `service/leaderboard.createLeaderboardBlocks` against an in-memory MongoDB. |
| `test/integration/service/metrics.js` | NEW — integration suite for `service/metrics.createMetricsBlocks` against an in-memory MongoDB. |
| `test/integration/service/deduction.js` | NEW — integration suite for `service/deduction` (`isBalanceSufficent`, `createDeduction`, `refundDeduction`) against an in-memory MongoDB. |
| `test/integration/service/recognition.js` | NEW — integration suite covering `giveRecognition` normal and golden-multiplier insertion, `getGoldenFistbumpHolder`, and `countRecognitionsReceived` against an in-memory MongoDB. |
| `test/integration/service/report.js` | NEW — integration suite covering `getTopMessagesForUser` aggregation and `getTotalRecognitionsForUser` count against an in-memory MongoDB. |
| `test/integration/bolt-wiring.js` | NEW — single-file wiring suite that drives a real `@slack/bolt` App through `app.processEvent`; asserts DM routing, regex matcher, and `GratitudeError` user-facing response. |
| `test/mocks/bolt-receiver.js` | NEW — no-op custom Bolt `Receiver` (`init`, `start`, `stop`); test-only, never shipped. |
| `test/mocks/bolt-app.js` | REUSE — already exports `createMockApp()`; used by all Unit 1 feature test files. Do not modify. |
| `test/integration/setup.js` | REUSE — root hook that starts in-memory MongoDB and patches `config.mongo_url`; new integration files must follow its deferred-require pattern. Do not modify. |
| `test/integration/service/balance.js` | REFERENCE — existing deferred-require pattern; new integration files under `test/integration/service/` mirror this layout. Do not modify. |
| `package.json` | EDIT — add `c8.thresholds` (statements/branches/functions/lines) so `npm test` exits non-zero when coverage drops below the floor. Preserve existing `reporter`, `all`, `include` keys. |

### Notes

- Unit tests run via `npm test` (`c8 mocha test/* --recursive --require test/setup.js --ignore 'test/integration/**'`). Integration tests run via `npm run test:integration` (`mocha 'test/integration/**/*.js' --require test/setup.js --require test/integration/setup.js`). Do not cross the two.
- Feature test pattern: instantiate `createMockApp()` from `test/mocks/bolt-app.js`, register the feature module, pull the handler out of `registrations.message[i].handler` / `registrations.event[i].handler` / `registrations.action[i].handler`, invoke it directly with a fake Slack context.
- Integration test pattern: require `service/` and `database/` modules **inside** `before()`, after `test/integration/setup.js`'s `beforeAll()` has patched `config.mongo_url`. Call `collection.deleteMany({})` in `beforeEach` to isolate state.
- Bolt wiring test: the real `@slack/bolt` `App` is constructed with the no-op receiver from `test/mocks/bolt-receiver.js`. Drive events via `app.processEvent({ body, ack })` — do not pull handlers out of a mock registrations list.
- Follow `docs/TESTING.md` throughout: Mocha `describe`/`it` with no arrow functions, `sinon.restore()` in `afterEach`, `chai-as-promised` for rejections.
- Run `npm run lint` before committing; husky pre-commit enforces it. Use `test:` / `chore:` Conventional Commit prefixes.
- **Branch strategy:** All five parent tasks are committed to a single feature branch `test/04-feature-and-integration-coverage`. Each parent task produces one commit on that branch (no branch switching between parent tasks). One PR ships the whole spec.
- No production code under `features/`, `service/`, `database/`, `middleware/`, `app.js`, or `config.js` is modified by any task in this spec. If a test surfaces a real bug, file it separately and `it.skip` the test with a reference.

## Tasks

### [x] 1.0 Feature handler unit test suite (Unit 1)

Add a unit test file under `test/features/` for every feature handler that is
currently at 0% coverage (`balance`, `deduction`, `golden-recognize`, `join`,
`leaderboard`, `metrics`, `redeem`, `refund`, `report`) and extend
`test/features/recognize.js` to cover the uncovered branches at lines 68,
72–73, and 90–175 of `features/recognize.js`. Use the established mock-Bolt
pattern in `test/mocks/bolt-app.js`; stub every service-layer dependency with
Sinon; touch no production source. Demoable end state: `npm test` runs the
new handler suites and `features/` statement coverage reported by c8 rises
to ≥ 75%.

#### 1.0 Proof Artifact(s)

- CLI: `npm test` output showing nine new feature test files under
  `test/features/` are executed, pass, and the full suite exits 0 —
  demonstrates each previously-uncovered handler is exercised by Mocha.
- Coverage report: c8 text summary section for `features/` showing statement
  coverage ≥ 75% — demonstrates the per-directory floor set in the spec is
  met.
- Grep: `git diff --stat main..HEAD -- features/ service/ database/ middleware/`
  returns zero lines — demonstrates the unit is test-only.

#### 1.0 Tasks

- [x] 1.1 Create `test/features/balance.js`. Register feature with `createMockApp()`, pull `registrations.message[0].handler`, stub `service/balance` functions (`currentBalance`, `lifetimeEarnings`, `dailyGratitudeRemaining`) and a fake `client.users.info` resolving `{ ok: true, user: { tz: "America/Los_Angeles" } }`. Assert `respondToUser` posts the three-line balance text. Add a second `it` where `users.info` returns `{ ok: false, error: "user_not_found" }` and assert the error text is posted.
- [x] 1.2 Create `test/features/deduction.js`. Cover five `it` blocks: (a) `users.info` returns `ok: false` → error text posted; (b) caller not in `config.redemptionAdmins` → "not allowed" text; (c) malformed command (`"deduct"` with < 4 tokens, bad user regex, non-numeric value) → usage hint; (d) `deduction.isBalanceSufficent` resolves `false` → insufficient-balance text; (e) happy path — stubs resolve `true`/deduction info → `client.chat.postMessage` called with the confirmation text including the deduction ID. Use `sinon.stub(config, "redemptionAdmins").value(["UADMIN1"])` to control the admin list.
- [x] 1.3 Create `test/features/golden-recognize.js`. Stub `recognition.gratitudeReceiverIdsIn`, `trimmedGratitudeMessage`, `gratitudeTagsIn`, `gratitudeCountIn`, `validateAndSendGratitude`, `giverGoldenSlackNotification`, and `apiwrappers.userInfo`. Cover: (a) happy path — assert `validateAndSendGratitude` called, `sendNotificationToReceivers` invoked, and `client.chat.postMessage` targets `config.goldenRecognizeChannel`; (b) `validateAndSendGratitude` rejects with `GratitudeError` → `handleGratitudeError` dispatch (assert via `postEphemeral`); (c) rejects with `SlackError` → `handleSlackError` dispatch; (d) rejects with plain `Error` → `handleGenericError` dispatch.
- [x] 1.4 Create `test/features/join.js`. Pull `registrations.event[0].handler`. Cover: (a) happy path — `client.conversations.join` invoked with `event.channel.id`; (b) stub `client.conversations.join` to throw a `SlackError` and assert `handleSlackError` is dispatched; (c) stub to throw a plain `Error` and assert `handleGenericError` is dispatched.
- [x] 1.5 Create `test/features/leaderboard.js`. Cover: (a) `respondToLeaderboard` — stub `leaderboard.createLeaderboardBlocks` to return `[{ type: "section" }]`, assert `respondToUser` posts with `text: "Gratibot Leaderboard"` and those blocks; (b) `updateLeaderboardResponse` — pull `registrations.action[0].handler`, stub `ack` and `respond`, assert `ack()` called and `respond()` receives the new blocks keyed by `action.value`.
- [x] 1.6 Create `test/features/metrics.js`. Mirror 1.5 for metrics: `respondToMetrics` happy path and `updateMetricsResponse` ack/respond path.
- [x] 1.7 Create `test/features/redeem.js`. Cover: (a) `respondToRedeem` — stub `balance.currentBalance` and `redeem.createRedeemBlocks`, assert `respondToUser` called with the blocks; (b) `redeemItem` non-"Liatrio Store" happy path — stub `redeem.getSelectedItemDetails` returning `{ itemName: "Sticker", itemCost: 5 }`, `deduction.isBalanceSufficent` true, `deduction.createDeduction` resolving an ID; assert `client.chat.postMessage` text includes cost and deduction ID; (c) `redeemItem` "Liatrio Store" branch — assert message includes "Please provide the link" and `deduction.createDeduction` is NOT called; (d) `redeemItem` insufficient balance — assert `client.chat.postEphemeral` called with the balance warning and no post otherwise.
- [x] 1.8 Create `test/features/refund.js`. Register the feature with `createMockApp()` and assert `registrations.message[0]` has matcher `/refund/i` and that `registrations.message[0].handler === refund.respondToRefund` (imported from `service/refund`). No service-call behavior is asserted here — service coverage lives in `test/service/refund.js`. This keeps the feature-layer "registration only" contract explicit.
- [x] 1.9 Create `test/features/report.js`. Cover `respondToReport`: (a) happy path with no mention and no time-range — `targetUserId === message.user`, `timeRange === 180` passed to `getTopMessagesForUser`/`getTotalRecognitionsForUser`; (b) `<@Uother>` in text — `targetUserId === "Uother"`; (c) trailing `30` — `timeRange === 30`; (d) `users.info` resolves `{ ok: false }` → generic error text posted; (e) `getTopMessagesForUser` rejects → generic error text posted. Cover `updateReportTimeRange`: (a) happy path — `ack`, `action.value = "Uother:30"`, `respond` called with blocks; (b) error path — `users.info` rejects → `respond` called with "Something went wrong" text and `replace_original: false`.
- [x] 1.10 Extend `test/features/recognize.js` with new `it` cases: (a) `validateAndSendGratitude` rejects with `SlackError` → `handleSlackError` dispatch via `postEphemeral` with slack-error text (covers line 68); (b) rejects with plain `Error` → `handleGenericError` dispatch (covers lines 72–73); (c) reaction-added handler: `registrations.event[0].handler` — `client.conversations.replies` returns a message that contains `:fistbump:`, assert `validateAndSendGratitude` called and `respondToUser` invoked with giver notification; (d) reaction handler short-circuits when `originalMessage.text` does NOT contain `recognizeEmoji`; (e) reaction handler `messageReactedTo` throws `SlackError` when `client.conversations.replies` returns `ok: false`, assert `handleSlackError` is dispatched; (f) reaction handler `giver_in_receivers = true` when reactor is a receiver.
- [x] 1.11 Run `npm test` locally; inspect the c8 text summary and confirm `features/` statement coverage ≥ 75%. If a file sits below 75%, add one or two targeted `it` cases for the missed branch — do **not** modify the feature source. Record the final `features/` coverage number in the PR description.
- [x] 1.12 Run `npm run lint`; fix any mocha-plugin or prettier violations with `npm run lint:fix`. Commit on the shared `test/04-feature-and-integration-coverage` branch with a `test:` prefixed message referencing this task section.

### [x] 2.0 `service/report.js` unit tests (Unit 2)

Create `test/service/report.js` following the conventions in `docs/TESTING.md`
(Mocha `describe`/`it`, Sinon stubs for `recognitionCollection`,
`chai-as-promised` for rejections, `sinon.restore()` in `afterEach`). Cover
the primary report generation paths exported from `service/report.js` plus at
least one failure mode (empty result set, validation error, or bubbled
collection error). Do not modify `service/report.js` to make it testable — if
a branch is genuinely untestable without a source change, mark it `it.skip`
with a reference to the spec's Open Questions. Demoable end state: the new
suite runs in `npm test` and `service/report.js` statement coverage reported
by c8 is ≥ 80%.

#### 2.0 Proof Artifact(s)

- CLI: `npm test` output showing `service/report` describe block executed and
  passing — demonstrates the report module now has automated checks.
- Coverage report: c8 text row for `service/report.js` showing statement
  coverage ≥ 80% — demonstrates the module is meaningfully exercised.

#### 2.0 Tasks

- [x] 2.1 Scaffold `test/service/report.js`: top-level `describe("service/report")`, `afterEach(() => sinon.restore())`, imports for `report`, `recognitionCollection`, `config`, `sinon`, and `expect` per the pattern in `test/service/balance.js`.
- [x] 2.2 `describe("getTopMessagesForUser")`: (a) happy path — stub `recognitionCollection.aggregate` to return `{ toArray: sinon.stub().resolves([{ _id: "msg-a", count: 3, firstTimestamp: new Date("2024-01-01"), channel: "C1", recognizers: ["U1", "U2"] }]) }`; assert result maps to `[{ message, count, timestamp, formattedDate, channel, recognizers }]` with `formattedDate === "Jan 1, 2024"`; (b) empty result — aggregate resolves `[]` → function returns `[]`.
- [x] 2.3 `describe("getTopMessagesForUser")` continued: (c) error path — stub `recognitionCollection.aggregate` to return `{ toArray: sinon.stub().rejects(new Error("boom")) }` and assert `await expect(...).to.be.rejectedWith("boom")` (covers the catch/rethrow branch).
- [x] 2.4 `describe("getTotalRecognitionsForUser")`: (a) happy path — `sinon.stub(recognitionCollection, "countDocuments").resolves(7)` → function returns `7`; (b) error path — `countDocuments` rejects → function rethrows (covers the catch/rethrow branch).
- [x] 2.5 `describe("createUserTopMessagesBlocks")`: (a) `topMessages.length === 0` → blocks array contains the "No `:fistbump:` found" section; (b) `topMessages.length > 0` with `recognizers.length <= 3` → block text includes `"from <@U1>, <@U2>"`; (c) `topMessages.length > 0` with `recognizers.length > 3` → block text includes `"from <@U1> and 3 others"` (use four recognizers); (d) actions block at the end contains three buttons with `value: "${userId}:30"`, `${userId}:180`, and `${userId}:365`.
- [x] 2.6 Run `npm test` and confirm the c8 row for `service/report.js` shows statement coverage ≥ 80%. If below, add branch cases for uncovered lines. If a branch is unreachable without a production change, add `it.skip` with a comment referencing Open Question #3 in the spec.
- [x] 2.7 Run `npm run lint`; commit on the shared `test/04-feature-and-integration-coverage` branch with a `test:` Conventional Commit message referencing this task section.

### [x] 3.0 Service-layer MongoDB integration suites (Unit 3)

Add integration test files under `test/integration/service/` for
`leaderboard`, `metrics`, `deduction`, `recognition`, and `report`, mirroring
the deferred-require pattern in `test/integration/service/balance.js`.
Database modules are required inside `before()` hooks, after
`test/integration/setup.js` has patched the memory-server URI onto the cached
config. No stubbing of `mongodb`, `mongodb-memory-server`, collection
modules, or `@slack/bolt`. The `recognition` suite must exercise both the
golden fistbump holder lookup and the multiplier recognition insertion path.
Every test must isolate state via `collection.deleteMany({})` (or equivalent)
between cases. Demoable end state: `npm run test:integration` executes the
new files end-to-end against a real in-memory MongoDB and exits 0.

#### 3.0 Proof Artifact(s)

- CLI: `npm run test:integration` output showing the five new suites
  (`leaderboard`, `metrics`, `deduction`, `recognition`, `report`) executed
  and passing, and the integration run exiting 0 — demonstrates each
  service-layer query runs correctly against a real MongoDB.
- Grep: `grep -rn "sinon.stub.*Collection\|require.*mongodb-memory-server" test/integration/`
  output showing zero collection-module stubs in the integration tests (only
  `test/integration/setup.js` references `mongodb-memory-server`) —
  demonstrates queries are not bypassed by stubs.

#### 3.0 Tasks

- [x] 3.1 Create `test/integration/service/leaderboard.js`. Follow the `balance.js` skeleton (top-level `this.timeout(30000)`, deferred `before()` requires for `service/leaderboard`, `recognitionCollection`, `goldenRecognitionCollection`, `deductionCollection`, `database/db`). `beforeEach` calls `deleteMany({})` on all three collections. Seed recognitions across multiple recognizers and recognizees, then call `leaderboard.createLeaderboardBlocks(30)` and assert the returned blocks contain a section naming the top recognizee.
- [x] 3.2 Create `test/integration/service/metrics.js`. Same skeleton. Seed recognitions, call `metrics.createMetricsBlocks(30)`, assert the returned blocks contain the total count reflected in the seed data.
- [x] 3.3 Create `test/integration/service/deduction.js`. Seed recognitions so a user has a positive balance; call `deduction.isBalanceSufficent(user, value)` and assert boolean outcomes for both sufficient and insufficient cases. Call `deduction.createDeduction(user, value, "test reason")` and assert the inserted document is visible in `deductionCollection.findOne({ user })`. Call `deduction.refundDeduction(insertedId)` and assert the record's `refund` flag flips to `true` via a subsequent `findOne`.
- [x] 3.4 Create `test/integration/service/recognition.js`. Seed a `goldenRecognitionCollection` record; call `recognition.getGoldenFistbumpHolder()` and assert the returned `goldenFistbumpHolder` matches the seed's `recognizee`. Call `recognition.giveRecognition(recognizer, recognizee, "m", "C", [], ":fistbump:")` and assert a document lands in `recognitionCollection`; repeat with `type = ":goldenfistbump:"` and assert the document lands in `goldenRecognitionCollection` (covers the multiplier/golden insertion branch). Call `recognition.countRecognitionsReceived(user)` and assert count matches seed size.
- [x] 3.5 Create `test/integration/service/report.js`. Seed five recognitions for one user with varying `message` values; call `report.getTopMessagesForUser(user, 30, "America/Los_Angeles")` and assert the aggregation returns the deduplicated top messages sorted by `count` desc; assert `formattedDate` format is `"MMM D, YYYY"`. Call `report.getTotalRecognitionsForUser(user, 30, "America/Los_Angeles")` and assert it equals the seeded count.
- [x] 3.6 Run `npm run test:integration` and confirm all five new suites pass and the run exits 0. If a suite hangs, verify it is not using `sinon.useFakeTimers` (which can break the memory server's heartbeats, per the note in `balance.js`).
- [x] 3.7 Run the grep check: `grep -rn "sinon.stub.*Collection\|require.*mongodb-memory-server" test/integration/`. Assert the only match for `mongodb-memory-server` is `test/integration/setup.js` and there are zero collection-module stubs elsewhere. If the grep surfaces a stub, remove it.
- [x] 3.8 Run `npm run lint`; commit on the shared `test/04-feature-and-integration-coverage` branch with a `test:` Conventional Commit message referencing this task section.

### [ ] 4.0 Bolt ↔ middleware wiring integration suite (Unit 4)

Add a no-op custom Bolt receiver at `test/mocks/bolt-receiver.js` (implements
`init(app)`, `start()`, `stop()`; opens no socket, binds no port). Add a
single wiring suite at `test/integration/bolt-wiring.js` that instantiates a
real `@slack/bolt` `App` against that receiver, loads at least three
representative features (`recognize`, `balance`, and one reaction-based
handler), and drives handlers via `app.processEvent({ body, ack })` with
realistic fake Slack event payloads. Assertions must cover, at minimum: (a) a
DM-only feature routed through `directMessage()` fires for `message.im` and
does not fire for the channel-equivalent event, (b) a regex/string
`app.message(...)` matcher fires on the expected input and does not fire on
a non-matching input, (c) when a handler's service throws `GratitudeError`,
the feature's error path responds through the captured Slack client stub
with the expected user-facing message. Keep the suite to a single file — do
not expand to one case per feature handler. Demoable end state:
`npm run test:integration` executes `bolt-wiring.js` and the run exits 0.

#### 4.0 Proof Artifact(s)

- CLI: `npm run test:integration` output showing
  `test/integration/bolt-wiring.js` executed, all three wiring assertions
  passing, and the run exiting 0 — demonstrates the real Bolt routing path
  is exercised.
- Grep: `grep -n "require.*@slack/bolt" test/integration/bolt-wiring.js`
  output showing the real `@slack/bolt` module is imported (not stubbed) —
  demonstrates the suite exercises the real framework.

#### 4.0 Tasks

- [ ] 4.1 Create `test/mocks/bolt-receiver.js`. Export a class (or factory) with `init(app)` (store the app reference), `start()` (return `Promise.resolve()`), `stop()` (return `Promise.resolve()`). No network, no WebSocket, no HTTP bind. Include a one-line comment marking it test-only.
- [ ] 4.2 Create `test/integration/bolt-wiring.js`. Require real `@slack/bolt` (top-level), the no-op receiver, the three representative feature modules (`features/balance`, `features/recognize`, and the reaction path of `features/recognize`), and the services they depend on. Top-level `describe("integration: bolt-wiring")` with `afterEach(() => sinon.restore())`.
- [ ] 4.3 Build a shared `makeApp()` helper inside the test file that: instantiates a new `App` with `{ receiver: new NoOpReceiver(), token: "xoxb-test", signingSecret: "test" }`, registers the three feature modules, and returns `{ app }`. The helper creates a fresh app per `it` to prevent handler-state leakage.
- [ ] 4.4 Write assertion (a) — DM routing via `directMessage()`: drive `app.processEvent({ body: { type: "event_callback", event: { type: "message", channel_type: "im", channel: "Duser", user: "U1", text: "balance", ts: "1.1" } }, ack: sinon.stub() })` with `service/balance` functions stubbed and `client.users.info` stubbed via a sinon `onCall` replacement on the Bolt context's client. Assert the balance response was posted. Then drive the same event with `channel_type: "channel"` and assert the handler was NOT invoked (balance stubs' `callCount === 0`).
- [ ] 4.5 Write assertion (b) — regex matcher: drive `app.processEvent` with a `message.im` whose text is `"balance"` and confirm routing; drive with text `"not a recognized command"` and confirm no handler fires. (Uses the same balance stubs cleared between drives.)
- [ ] 4.6 Write assertion (c) — `GratitudeError` propagation: stub `service/recognition.validateAndSendGratitude` to reject with `new GratitudeError(["- You can't recognize yourself"])`, stub `client.users.info` to return valid user objects, and drive a `message` event containing `:fistbump:`. Intercept `client.chat.postEphemeral` (via a sinon replacement on the Bolt client) and assert it was called with text including `"Sending gratitude failed"` and `"You can't recognize yourself"`.
- [ ] 4.7 Intercept the Bolt client per-event without stubbing the `@slack/bolt` module itself. Strategy: in each `it`, before calling `processEvent`, attach a Bolt `app.use(async ({ client, next }) => { ...replace methods... ; await next(); })` global middleware that replaces `client.users.info`, `client.chat.postEphemeral`, `client.chat.postMessage`, and `client.reactions.add` with sinon stubs so the assertions can read call args.
- [ ] 4.8 Run `npm run test:integration`; confirm the wiring suite passes and the integration run exits 0. If Bolt complains about a missing token/receiver combination, consult the Bolt v4 custom-receiver docs (use context7 if needed) rather than stubbing Bolt.
- [ ] 4.9 Run the grep check: `grep -n "require.*@slack/bolt" test/integration/bolt-wiring.js` and confirm a single real import. Confirm no `sinon.stub(require("@slack/bolt"), ...)` appears anywhere in the file.
- [ ] 4.10 Run `npm run lint`; commit on the shared `test/04-feature-and-integration-coverage` branch with a `test:` Conventional Commit message referencing this task section.

### [ ] 5.0 Coverage floor enforcement in c8 (Unit 5)

Declare `c8.thresholds` in `package.json` (or equivalent c8 config location)
so that `npm test` exits non-zero when a threshold is not met. Initial
targets: statements 80%, branches 85%, functions 80%, lines 80%. Tune final
committed values to what the Unit 1–4 additions actually achieve; any
deviation from the initial targets is recorded in the spec's Open Questions
and in the implementation PR description. Preserve the existing `text` and
`lcov` reporters. If a threshold cannot be met with test-only additions,
lower the threshold and document the gap — do not modify production source
to hit the number. Demoable end state: `npm test` continues to pass,
`c8.thresholds` is committed, and a deliberate threshold-violation run
(performed locally in a scratch branch, not committed) confirms `npm test`
exits non-zero when coverage falls below the configured floor.

#### 5.0 Proof Artifact(s)

- CLI: `npm test` output showing the coverage summary, the configured
  threshold values, and a clean exit 0 — demonstrates the floor is declared
  and currently satisfied. A local scratch-branch run deliberately violating
  the threshold and exiting non-zero is captured separately as evidence that
  the floor actually gates the build.
- Git diff: `git diff main..HEAD -- package.json` showing the
  `c8.thresholds` (or equivalent) block added — demonstrates the floor is
  declared in committed config.

#### 5.0 Tasks

- [ ] 5.1 After Units 1–4 have landed (or at least the test additions are in place locally), run `npm test` and record the achieved totals for statements, branches, functions, and lines from the c8 text summary.
- [ ] 5.2 Edit `package.json`: under the existing `c8` key, add `"statements": 80, "branches": 85, "functions": 80, "lines": 80` as top-level c8 options (c8 reads these as thresholds directly — no nested `thresholds` key needed). Keep the existing `reporter`, `all`, and `include` keys intact.
- [ ] 5.3 If any target from 5.2 exceeds the achieved value from 5.1, lower that target to the achieved value rounded down to the nearest whole percent. Record the deviation in the spec's Open Question #1 and in the PR description — do **not** modify any file under `features/`, `service/`, `database/`, `middleware/`, `app.js`, or `config.js` to hit the number.
- [ ] 5.4 Run `npm test` and confirm the coverage thresholds now appear in the c8 output and the command exits 0.
- [ ] 5.5 Deliberate-violation sanity check (local only, do NOT commit): on a scratch branch, temporarily delete one feature test file, run `npm test`, and confirm c8 exits non-zero citing the violated threshold. Discard the scratch branch. Capture the failing output for the PR description.
- [ ] 5.6 Run `npm run lint`; commit on the shared `test/04-feature-and-integration-coverage` branch with a `chore:` Conventional Commit message referencing this task section. Include the final threshold values in the commit body.
