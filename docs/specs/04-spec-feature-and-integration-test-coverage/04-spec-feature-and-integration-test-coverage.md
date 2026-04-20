# 04-spec-feature-and-integration-test-coverage

## Introduction/Overview

`npm test` currently reports 63.64% statement coverage. The gaps are concentrated in four
areas: feature handlers in `features/` (nine of eleven files at 0%), `service/report.js`
(0%, 248 lines, no test file), service-layer query correctness (every database call is
stubbed in unit tests), and the Bolt ↔ middleware wiring seam (never exercised — custom
matchers in `middleware/index.js` and the regex/string matchers passed to
`app.message(...)` could silently break on a Bolt upgrade with no test failure).

This spec adds the missing unit, integration, and wiring tests, and enforces a coverage
floor in c8 config so regressions fail CI. All changes are test-only; no production
source is modified.

## Goals

1. Cover every 0%-coverage feature file (`balance`, `deduction`, `golden-recognize`,
   `join`, `leaderboard`, `metrics`, `redeem`, `refund`, `report`) and lift
   `features/recognize.js` above its current 50% by covering the remaining error-dispatch
   and assembly branches.
2. Add a dedicated unit test file for `service/report.js` covering primary success paths
   and at least one failure mode.
3. Add service-layer integration tests that run against a real in-memory MongoDB (using
   the existing `mongodb-memory-server` harness) for `leaderboard`, `metrics`,
   `deduction`, `recognition` (including golden-fistbump holder lookup and multiplier
   record insertion), and `report`.
4. Add a single Bolt-wiring integration suite that instantiates a real `@slack/bolt` App
   against a no-op custom receiver and drives feature handlers via `app.processEvent(...)`
   with fake Slack event payloads, proving the middleware matchers and error propagation
   path actually work end-to-end.
5. Enforce a coverage floor in the `c8` configuration so regressions fail CI.

## User Stories

- **As a Gratibot maintainer**, I want feature-handler logic covered by unit tests so that
  error dispatch, gratitude assembly, and `giver_in_receivers` branches cannot silently
  regress between manual dev Slack app checks.
- **As a maintainer upgrading `@slack/bolt`**, I want a real-Bolt wiring test so that
  breakage in the middleware matchers or event router surfaces in CI instead of
  production.
- **As a developer modifying a service-layer query**, I want at least one test that runs
  my query against a real MongoDB so that a wrong field name, wrong sort direction, or
  missing `.toArray()` cannot pass the test suite.
- **As a reviewer of a new PR**, I want CI to fail when coverage drops below an agreed
  floor so that under-tested changes are blocked at review time, not discovered later.
- **As a maintainer touching `service/report.js`**, I want unit tests for the module so
  that I can refactor it without relying solely on manual Slack DM verification.

## Demoable Units of Work

### Unit 1: Feature handler unit tests

**Purpose:** Close the coverage gap in `features/` by unit-testing every handler file
that currently has 0% coverage and filling the uncovered branches in
`features/recognize.js`. Uses the established mock-Bolt pattern — no framework boot, no
new dependencies.

**Functional Requirements:**

- The test suite shall include a new file under `test/features/` for each of:
  `balance.js`, `deduction.js`, `golden-recognize.js`, `join.js`, `leaderboard.js`,
  `metrics.js`, `redeem.js`, `refund.js`, `report.js`.
- Each feature test file shall use `createMockApp()` from `test/mocks/bolt-app.js`,
  retrieve the registered handler(s) from the recorded registrations, and invoke them
  directly with a fake Slack context.
- Each feature test file shall cover the handler's happy path and at least one error or
  branching path that currently goes untested (e.g., `GratitudeError` vs. `SlackError`
  dispatch, admin-only guard, `giver_in_receivers` short-circuit, deduction refund path).
- The suite shall extend `test/features/recognize.js` to cover the currently uncovered
  branches noted at lines 68, 72–73, and 90–175 of `features/recognize.js`.
- Each feature test shall stub its service-layer dependencies with Sinon; no service
  function shall execute against a real database in this unit.
- `features/` statement coverage reported by `c8` shall be at least 75% after this
  unit lands.
- No production code under `features/` or `service/` shall be modified by this unit.

**Proof Artifacts:**

- CLI: `npm test` output showing the new feature test files are executed and pass,
  demonstrating the handler logic is now unit-tested.
- Coverage report: `c8` text summary showing `features/` statement coverage ≥ 75%,
  demonstrating the coverage gap is closed.
- Git diff: `git diff --stat main -- features/ service/` shows zero lines changed,
  demonstrating the unit is test-only.

### Unit 2: `service/report.js` unit tests

**Purpose:** Bring `service/report.js` from 0% coverage to a level comparable to the
other service-layer files. This module is currently invisible to the test suite.

**Functional Requirements:**

- The test suite shall include a new file `test/service/report.js` following the
  conventions documented in `docs/TESTING.md` (Mocha `describe`/`it`, Sinon stubs for
  collections, `chai-as-promised` for rejections, `sinon.restore()` in `afterEach`).
- The suite shall cover the primary report generation path(s) exported by
  `service/report.js`.
- The suite shall cover at least one failure mode (e.g., empty result set, validation
  failure, or bubbled error from a stubbed collection call).
- `service/report.js` statement coverage reported by `c8` shall be at least 80% after
  this unit lands.
- `service/report.js` itself shall not be modified to make it testable. If a function is
  genuinely untestable without a source change, it shall be noted in the test file and
  skipped, and a follow-up item shall be added to `Open Questions` for triage — no
  production change in this spec.

**Proof Artifacts:**

- CLI: `npm test` output showing `test/service/report.js` suite executed and passing,
  demonstrating the module now has automated checks.
- Coverage report: `c8` text summary showing `service/report.js` statement coverage ≥
  80%, demonstrating the module is meaningfully exercised.

### Unit 3: Service-layer MongoDB integration tests

**Purpose:** Close the query-correctness gap. Unit tests stub every
`find`/`findOne`/`insertOne`, so a wrong filter field, wrong sort direction, or missing
`.toArray()` on a cursor would never fail. Running the same service functions against a
real in-memory MongoDB catches these.

**Functional Requirements:**

- The test suite shall include new files under `test/integration/service/` for
  `leaderboard`, `metrics`, `deduction`, `recognition`, and `report`.
- Each new integration test file shall follow the deferred-require pattern already
  documented in `test/integration/setup.js` and `test/integration/service/balance.js`
  (database modules are required only after the memory server URI has been patched onto
  the cached `config` object).
- No integration test shall stub `mongodb`, `mongodb-memory-server`, a database
  collection module (`database/recognitionCollection.js`,
  `database/goldenRecognitionCollection.js`, `database/deductionCollection.js`), or the
  `@slack/bolt` package.
- The `recognition` integration file shall exercise both the golden fistbump holder
  lookup and the multiplier recognition insertion path.
- Each test shall isolate state from other tests (e.g., by calling
  `collection.deleteMany({})` in `afterEach` or equivalent).
- `npm run test:integration` shall execute the new files as part of the integration run
  and shall exit 0.
- Every service file with query logic (`balance`, `leaderboard`, `metrics`, `deduction`,
  `recognition`, `report`) shall have at least one integration test that exercises at
  least one real MongoDB query.

**Proof Artifacts:**

- CLI: `npm run test:integration` output showing the new files executed and passing,
  demonstrating queries run correctly against a real MongoDB.
- Grep: `grep -rn "sinon.stub.*Collection\\|require.*mongodb-memory-server" test/integration/`
  output confirming no collection-module stubs in integration tests (only the setup file
  references `mongodb-memory-server`), demonstrating queries are not bypassed.

### Unit 4: Bolt ↔ middleware wiring integration suite

**Purpose:** Exercise the seam no other test covers — the real `@slack/bolt` App, the
custom matchers in `middleware/index.js` (`directMessage`, `anyOf`, `reactionMatches`),
and the regex/string matchers passed to `app.message(...)`. A Bolt major upgrade could
silently break any of these; this suite catches that.

**Functional Requirements:**

- The test suite shall include one new file at `test/integration/bolt-wiring.js`.
- The suite shall construct a real `@slack/bolt` `App` instance backed by a custom
  receiver that is a no-op (implements `init(app)`, `start()`, and `stop()`; opens no
  WebSocket and binds no HTTP port). The receiver stub shall live under
  `test/mocks/bolt-receiver.js` (test-only; not shipped).
- The suite shall load at least three representative features: `recognize`, `balance`,
  and one reaction-based feature (e.g., the reaction-triggered recognize path).
- The suite shall drive handlers via `app.processEvent({ body, ack })` with realistic
  fake Slack event payloads — it shall not pull handlers out of a mock registrations
  list.
- The suite shall assert, at minimum:
  - (a) A DM-only feature routed through `directMessage()` fires for a `message.im` event
    and does **not** fire for an equivalent channel message.
  - (b) A message feature whose `app.message(...)` matcher is a regex or string fires on
    the expected input and does **not** fire on a non-matching input.
  - (c) When a handler's underlying service throws `GratitudeError`, the feature's error
    path responds via the captured Slack client stub with the expected user-facing
    message.
- The suite shall be runnable via `npm run test:integration` as part of the integration
  run and shall exit 0.
- The suite shall remain a single file covering the seam once — it shall not grow to
  one case per feature handler. Per-feature coverage lives in Unit 1.

**Proof Artifacts:**

- CLI: `npm run test:integration` output showing `test/integration/bolt-wiring.js`
  executed and passing, demonstrating the real Bolt routing is exercised.
- Grep: `grep -n "require.*@slack/bolt" test/integration/bolt-wiring.js` output
  showing the real `@slack/bolt` module is imported (not stubbed), demonstrating the
  suite exercises the real framework.

### Unit 5: Coverage floor enforcement in c8

**Purpose:** Ensure the coverage gains land with a ratchet so future changes cannot
silently regress below the agreed floor.

**Functional Requirements:**

- The `c8` configuration in `package.json` shall declare coverage thresholds that cause
  `npm test` to exit non-zero when any threshold is not met.
- The initial thresholds shall target statements 80%, branches 85%, functions 80%, lines
  80%, with final values tunable during implementation to what is achievable given the
  tests produced by Units 1–4.
- Any deviation from the target thresholds in the final committed config shall be
  documented in the spec's `Open Questions` section or resolved during implementation
  review.
- `npm test` shall continue to produce the existing `text` and `lcov` reports.
- No production code shall be modified to achieve the threshold. If the threshold cannot
  be met with test-only additions, the threshold shall be lowered and the gap documented
  rather than adjusting production source in this spec.

**Proof Artifacts:**

- CLI: `npm test` output showing the coverage summary and that the thresholds gate
  the exit code (a deliberate threshold-violation run in a scratch branch is optional;
  the passing run is sufficient), demonstrating the floor is enforced.
- Git diff: `git diff package.json` showing the `c8.thresholds` (or equivalent) block
  added, demonstrating the floor is declared in committed config.

## Non-Goals (Out of Scope)

1. **No production code changes.** If a test surfaces a real bug in `features/`,
   `service/`, `database/`, or `middleware/`, the bug shall be filed separately and
   fixed in its own PR — not patched as part of this work. Tests that would fail because
   of a known existing bug may be written as `skipped` with a reference to the follow-up
   ticket, or omitted entirely.
2. **No new npm dependencies.** `@slack/bolt`, `mongodb`, `mongodb-memory-server`,
   Mocha, Chai, Sinon, and `c8` are already in the tree. Any perceived need for a new
   library should instead be satisfied with a small test helper.
3. **No service refactors for testability.** If a function cannot be tested without
   restructuring its production source, the function is noted and skipped for this
   spec.
4. **No per-feature Bolt-wiring tests.** Unit 4 covers the seam once. Handler-by-handler
   routing checks are not added to the wiring suite — each feature's routing is
   implicitly validated by its Unit 1 unit test.
5. **No changes to feature handlers to make them easier to unit-test.** The existing
   mock-Bolt pattern in `test/mocks/bolt-app.js` is sufficient.
6. **No changes to CI workflow files or release pipeline.** The coverage floor is
   enforced by `c8` inside `npm test`, which CI already invokes.
7. **No replacement of existing unit tests with integration tests.** Integration tests
   are additive; existing stubbed unit tests remain.

## Design Considerations

No specific UI/UX design requirements. This spec adds developer-facing tests and
configuration only.

## Repository Standards

Implementation shall follow the patterns already established in this repository:

- **Testing stack and conventions:** Mocha + Chai (`expect` style) + `chai-as-promised`
  + Sinon as documented in `docs/TESTING.md`. Use `describe`/`it` blocks; no arrow
  functions in `describe`/`it` (Mocha binds `this`; ESLint mocha rules enforce this).
  Always call `sinon.restore()` in `afterEach`.
- **Test layout:** `test/` mirrors source structure. Service unit tests live in
  `test/service/`, feature unit tests in `test/features/`, middleware tests in
  `test/middleware/`, integration tests in `test/integration/` with a service mirror
  under `test/integration/service/`.
- **Integration deferred-require pattern:** Database modules are required only after
  `test/integration/setup.js` has patched the memory server URI onto the cached
  `config` object. Follow the reference implementation in
  `test/integration/service/balance.js`.
- **Feature test pattern:** Instantiate `createMockApp()` from `test/mocks/bolt-app.js`,
  pull the handler by index from the recorded registrations, invoke with a fake Slack
  context. See `test/features/recognize.js` and `test/features/help.js` for worked
  examples.
- **Naming:** kebab-case file names; camelCase function/variable names.
- **Async style:** `async`/`await` throughout; no raw `.then()` chains. Propagate errors
  naturally.
- **Logging:** Winston is silenced in tests via `test/setup.js`. Tests do not assert on
  log lines.
- **Lint and format:** `npm run lint` must pass before commit (enforced by husky
  pre-commit hook). Fix auto-fixable issues with `npm run lint:fix`.
- **Commit convention:** Changes in this spec are test-only and tooling-config; use
  `test:` and `chore:` commit prefixes per Conventional Commits.
- **Branch discipline:** Work on a feature branch (`test/...` or `chore/...`); direct
  pushes to `main` are blocked.

## Technical Considerations

- **Mock-Bolt for Unit 1; real-Bolt for Unit 4.** Unit 1 must use the mock app from
  `test/mocks/bolt-app.js` to stay fast and dependency-free. Unit 4 must use the real
  `@slack/bolt` App with a custom receiver so that the middleware matchers and event
  router are actually executed. Do not mix these two approaches within one file.
- **Bolt custom receiver contract.** A Bolt `Receiver` only needs to implement three
  methods: `init(app)`, `start()`, and `stop()`. For the wiring suite, all three are
  no-ops. Tests drive events by calling `app.processEvent({ body, ack })` directly with
  a fake event body and a sinon-stubbed `ack`. The captured `client` on the event
  context can be replaced with a sinon-stubbed Slack Web API client to assert outgoing
  calls.
- **`mongodb-memory-server` boot cost.** First boot may download the MongoDB binary;
  `test/integration/setup.js` already accommodates this with a 120 s timeout. The
  integration run is slower than the unit run — this is acceptable and is why the two
  runs are separate npm scripts.
- **Lazy-require to pick up the memory-server URI.** Database modules read
  `config.mongo_url` when first required. Integration test files must not `require` a
  database module or any service module that transitively requires one until *inside* a
  `before()` hook that runs after the root `beforeAll()` in
  `test/integration/setup.js`. The reference file already demonstrates this.
- **No stub leakage.** Every test file must call `sinon.restore()` in `afterEach`. The
  integration suite must also clean collection state between tests.
- **Coverage threshold tuning.** The initial targets (80/85/80/80) are starting values.
  If, after Units 1–4 land, one metric is only achievable by modifying production code,
  lower that threshold to what the test-only additions can deliver and note it in the
  spec's open questions. Raising the floor later in a follow-up PR is preferred over
  modifying production source to hit a number.
- **Helper extraction threshold.** Extract a shared test helper only when the same
  scaffolding appears in three or more feature test files. Under that threshold, prefer
  duplication for readability.
- **Receiver stub location.** Place the no-op receiver at `test/mocks/bolt-receiver.js`
  alongside `test/mocks/bolt-app.js`. The two mocks serve different layers (unit vs.
  integration) but live together for discoverability.

## Security Considerations

- **No secrets or tokens in test fixtures.** Fake Slack user IDs (e.g., `Ugiver`,
  `Ureceiver`, `UADMIN1`) and synthetic event payloads only. Never place real workspace
  tokens, OAuth tokens, or production user IDs in tests.
- **No real network calls.** The real `@slack/bolt` App used in Unit 4 must be backed
  by a no-op custom receiver so it opens no WebSocket and binds no port. Every Slack
  Web API call made by a handler under test must be routed through a Sinon stub.
- **Integration database is ephemeral.** `mongodb-memory-server` runs a per-process
  in-memory MongoDB; no persistent data is written. No shared fixtures cross process
  boundaries.
- **No commit of coverage artifacts.** Ensure `.gitignore` already excludes `coverage/`
  and `lcov.info`; if not, that is the one production-adjacent change permitted under
  this spec.

## Success Metrics

1. **Feature coverage floor met:** `features/` statement coverage ≥ 75% in `npm test`
   output.
2. **Report module covered:** `service/report.js` statement coverage ≥ 80%.
3. **Query correctness covered:** Every service file with query logic (`balance`,
   `leaderboard`, `metrics`, `deduction`, `recognition`, `report`) has ≥ 1 integration
   test exercising a real MongoDB query.
4. **Seam covered once:** `test/integration/bolt-wiring.js` asserts on at least the
   three wiring scenarios (DM routing, regex matcher, `GratitudeError` propagation).
5. **Ratchet in place:** `npm test` fails when coverage drops below the configured
   `c8.thresholds`; verified locally by a deliberate threshold-violation run in a
   scratch branch before closing the work.
6. **No production drift:** `git diff main -- features/ service/ database/ middleware/
   app.js config.js` is empty at merge time.
7. **Integration suite independence:** `npm test` and `npm run test:integration` each
   exit 0 when run in isolation from the other.

## Open Questions

1. **Final threshold values.** Target is 80/85/80/80. If branches or functions cannot
   reach target without modifying production source, the threshold is lowered to what
   the test-only additions achieve. Final committed values shall be recorded here or
   in the implementation PR description.
2. **Handling of dead branches revealed during testing.** If a feature handler has a
   branch that cannot be reached without modifying production code (e.g., a truly
   unreachable `else`), the preferred approach — exclude via `c8` comments or accept
   the coverage hit — shall be decided during review of Unit 1.
3. **Extent of `service/report.js` coverage beyond 80%.** Whether to push past the
   minimum target depends on how many branches are testable without touching production
   source; confirmed during Unit 2 implementation.
