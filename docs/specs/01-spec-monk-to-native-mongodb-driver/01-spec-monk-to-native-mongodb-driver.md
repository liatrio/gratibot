# 01-spec-monk-to-native-mongodb-driver

## Introduction/Overview

Gratibot currently uses Monk (`^7.3.1`) as its MongoDB wrapper. Monk has been effectively
unmaintained since April 2021 and depends on the MongoDB Node.js driver v3, which reached
end-of-life in 2021 and no longer receives security patches. This spec describes replacing
Monk with the native `mongodb` npm package (v6) to eliminate the EOL dependency, restore
security patching coverage, and use a driver that is compatible with the MongoDB 4.2 API
already running in production CosmosDB.

## Goals

- Remove Monk and the EOL MongoDB driver v3 from the dependency tree entirely.
- Replace all Monk-specific database calls (`insert`, `count`, `find`, `createIndex`,
  `monk.id()`) with their native driver equivalents.
- Wire explicit database connection management into the app startup sequence.
- Expose a working database health check in the `/health` endpoint (resolving the existing
  `// TODO` at `app.js:51–53`).
- Pin the CosmosDB MongoDB API version in Terraform so it is visible in source control.
- Keep all existing tests green with only mechanical stub updates (no logic changes).

## User Stories

**As a maintainer**, I want the MongoDB driver dependency to receive security patches so
that known vulnerabilities do not go unaddressed in production.

**As an operator**, I want the `/health` endpoint to reflect database connectivity so that
the readiness probe correctly reports when the bot is unable to reach MongoDB.

**As a developer**, I want the database layer to use the official MongoDB driver API so
that I can reference up-to-date documentation without translating from Monk's abstraction.

## Demoable Units of Work

### Unit 1: Database Layer — Replace Monk with Native MongoClient

**Purpose:** Replace `database/db.js` and all three collection files so that the rest of
the codebase can continue importing collections as before, with no Monk APIs remaining
in the `database/` directory.

**Functional Requirements:**
- The system shall replace `monk(mongo_url)` in `database/db.js` with a `MongoClient`
  instance from the native `mongodb` package; the module shall export the client.
- The system shall replace `db.get(collectionName)` in each collection file with
  `client.db().collection(collectionName)`.
- The system shall update all `createIndex` calls from string syntax
  (`createIndex('field')`) to object syntax (`createIndex({ field: 1 })`).
- The system shall replace `collection.insert(doc)` calls in collection init code with
  `collection.insertOne(doc)`.
- The `goldenRecognitionCollection.js` init call shall have a `.catch()` attached so
  startup errors are logged via Winston (see audit issue H4).
- The `mongodb` package shall be added to `package.json` and `monk` removed.

**Proof Artifacts:**
- `npm install` output: `monk` no longer appears in `node_modules`; `mongodb` v6 is
  present — demonstrates dependency swap is complete.
- `npm test` output: all tests pass after the database layer change and before service
  layer updates — demonstrates the collection modules are still importable and stubs
  still work at this stage.

---

### Unit 2: Service Layer — Update All Query and Write Call Sites

**Purpose:** Update every service file that calls Monk-specific collection methods so that
they use the native driver API, and update the matching test stubs to reflect cursor-based
`find()` results.

**Functional Requirements:**
- The system shall replace every `collection.find(filter)` call in `service/` with
  `collection.find(filter).toArray()` — the native driver returns a cursor, not an array.
  Affected files: `service/recognition.js:153`, `service/balance.js:31`,
  `service/deduction.js:51`.
- The system shall replace every `collection.count(filter)` call with
  `collection.countDocuments(filter)`.
  Affected files: `service/report.js:114`, `service/balance.js:25–26,45`,
  `service/recognition.js:74,96`.
- The system shall replace every `collection.insert(doc)` call in service files with
  `collection.insertOne(doc)`.
  Affected files: `service/recognition.js:50,52`, `service/deduction.js:17`.
- The system shall replace `monk.id(id)` in `service/deduction.js:28` with
  `new ObjectId(id)` imported from `'mongodb'`, and remove the `monk` import from that
  file — this resolves a cross-layer Monk dependency in the service layer.
- Every test stub for `collection.find` in `test/service/` shall be updated to return a
  cursor-like object: `{ toArray: async () => [...] }` instead of resolving directly to
  an array.

**Proof Artifacts:**
- `npm test` output: all tests pass after service layer and test stub updates — demonstrates
  the new call patterns are correctly implemented and tested.
- Code search: `grep -r "monk" service/` returns no matches — demonstrates no Monk
  imports remain in the service layer.

---

### Unit 3: App Startup, Health Check, and Infrastructure

**Purpose:** Wire explicit connection management into app startup, implement the database
health check, and pin the CosmosDB MongoDB API version in Terraform.

**Functional Requirements:**
- The system shall add an explicit `await client.connect()` call in `app.js` before
  features are loaded and before `app.start()` is called, so that a database connection
  failure prevents startup.
- The system shall remove the vestigial port argument from `app.start(3000)` — in socket
  mode Bolt does not bind an HTTP port; the argument is silently ignored.
- The system shall wrap the startup IIFE in `try/catch` and call `process.exit(1)` with a
  Winston error log on failure (resolving audit issue M1).
- The system shall implement the database health check at `app.js:51–53` using
  `await client.db().command({ ping: 1 })`, replacing the existing `// TODO` comment.
- The `infra/terraform/cosmosdb.tf` `azurerm_cosmosdb_account` resource shall include
  `mongo_server_version = "4.2"` to make the API version explicit in source control.

**Proof Artifacts:**
- `GET /health` response body: `{ "database": "OK", ... }` — demonstrates the health
  check now covers MongoDB connectivity.
- `terraform plan` output from nonprod: zero-resource-change plan — demonstrates
  `mongo_server_version = "4.2"` is treated as a no-op on the existing account.
- `npm test` output: all tests pass — demonstrates startup changes did not break anything.

---

## Non-Goals (Out of Scope)

1. **No business logic changes**: This migration must not alter recognition counts,
   leaderboard results, or any other bot behaviour. Only the database access layer changes.
2. **No other audit issues**: Issues H1–H4, M1–M4, L1–L11 are separate; this spec covers
   only M5, except where M5 explicitly overlaps with M1 and M3 (startup error handling and
   the health check TODO, both of which are resolved as part of the native driver wiring).
3. **No CosmosDB API version upgrade**: The spec pins the *existing* 4.2 version in
   Terraform. Upgrading to a newer CosmosDB API version is out of scope.
4. **No Luxon/moment migration**: Replacing `moment-timezone` (audit issue L11) is a
   separate spec.
5. **No feature handler tests**: Feature handlers in `features/` are not unit-tested per
   project convention; this spec does not add any.

## Design Considerations

No specific design requirements identified. This is a backend dependency migration with no
user-facing interface changes.

## Repository Standards

- **Architecture**: Strict three-layer separation must be maintained. The `database/` layer
  exports collection objects; `service/` imports them. After this change, no file in
  `service/` should import `monk` (the `monk.id()` usage in `service/deduction.js` is the
  one violation to fix).
- **File naming**: kebab-case (`db.js`, `recognitionCollection.js`). No new files needed.
- **Async**: `async`/`await` throughout; no raw `.then()` chains.
- **Logging**: Winston for all error logging (`winston.error(...)` with structured context).
- **Tests**: Mocha/Chai/Sinon in `test/service/`. Stubs use `sinon.stub(...).resolves(...)`.
  After this change, `find` stubs must return `{ toArray: async () => [...] }`.
- **Commit convention**: `chore(deps):` prefix per the audit change checklist.
- **Branch**: Work on a feature branch; direct pushes to `main` are blocked.
- **Pre-commit**: Run `npm run test-n-lint` before committing.

## Technical Considerations

- **Target driver version**: `mongodb` v6 (current stable). Install with
  `npm install mongodb` and `npm uninstall monk`.
- **Connection lifecycle**: The native driver requires `client.connect()` before any
  operations. In Monk this was implicit. The `MongoClient` instance should be created in
  `database/db.js` and exported; `app.js` calls `await client.connect()` at startup.
  Collection files call `client.db().collection(name)` — this is safe to call before
  `connect()` because Monk used to queue operations; the native driver collection reference
  is also just a pointer resolved at operation time.
- **`find()` return type**: In Monk, `collection.find(filter)` returns a Promise that
  resolves to an array. In the native driver it returns a `FindCursor`. Every call site
  must append `.toArray()` to get an array. This is the most widespread change.
- **`countDocuments()` vs `count()`**: `count()` is deprecated and removed in native driver
  v6. Use `countDocuments(filter)` as a direct replacement.
- **`insertOne()` return value**: Returns `{ acknowledged, insertedId }`. If any service
  code uses the return value of `insert()`, check that it does not rely on Monk's return
  shape (Monk returns the inserted document). Review `service/recognition.js:50,52` and
  `service/deduction.js:17` call sites.
- **`findOneAndUpdate()` return value**: In native driver v6 the default is to return the
  document *before* the update (`returnDocument: 'before'`). Monk returned the document
  after. Review `service/deduction.js:27` (`refundDeduction`) to confirm the caller does
  not depend on the post-update value. If it does, add `{ returnDocument: 'after' }`.
- **`ObjectId`**: Import `{ ObjectId }` from `'mongodb'` in `service/deduction.js` and
  use `new ObjectId(id)` to replace `monk.id(id)`.
- **Index syntax**: Native driver `createIndex` takes an object `{ field: 1 }`, not a
  plain string.
- **Health check**: `client.db().command({ ping: 1 })` is the idiomatic native driver
  connectivity check. The `db` object from Monk (which previously had
  `db.executeWhenOpened()`) is replaced by this approach.
- **Terraform plan before apply**: Run `terragrunt plan` on both nonprod and prod
  workspaces before applying the `mongo_server_version = "4.2"` change to confirm Azure
  treats it as a no-op on the existing account.

## Security Considerations

- The MongoDB connection string (`MONGO_URL`) is already managed as an environment
  variable in `config.js` and must not be hardcoded or committed.
- No new credentials or tokens are introduced by this change.
- Removing the EOL MongoDB driver v3 directly eliminates exposure to any unpatched CVEs
  in that version — this is the primary security motivation for the migration.
- Proof artifacts (test output, health check responses) must not include connection strings
  or credentials.

## Success Metrics

1. **All tests pass**: `npm test` exits 0 with no skipped or failing tests after all
   three units are complete.
2. **No Monk references remain**: `grep -r "monk" database/ service/ app.js` returns
   zero matches.
3. **Health check covers database**: `GET /health` includes `"database": "OK"` when
   MongoDB is reachable, and a non-OK status when it is not.
4. **Terraform plan is a no-op**: `terragrunt plan` shows 0 resources to add, change, or
   destroy for the `mongo_server_version` addition.
5. **Bot behaviour is unchanged**: Manual smoke test in the dev Slack app confirms
   recognition giving, balance queries, and leaderboard all work correctly after the
   migration.

## Open Questions

1. **`findOneAndUpdate` return shape**: Does `service/deduction.js`'s `refundDeduction`
   function (or its callers in `features/refund.js`) depend on receiving the post-update
   document value? If yes, add `{ returnDocument: 'after' }` to the native driver call.
   Needs a quick read of `features/refund.js` before implementing Unit 2.
2. **`insertOne` return value usage**: Does any caller of `createDeduction`
   (`service/deduction.js:17`) or `giveRecognition` (`service/recognition.js:50,52`) use
   the return value of the `insert()` call? If yes, update to extract `insertedId` from
   the `insertOne` result rather than treating it as the full document.
