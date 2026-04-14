# 01-tasks-monk-to-native-mongodb-driver

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `package.json` | Remove `monk` dependency, add `mongodb` v6. |
| `database/db.js` | Replace `monk(mongo_url)` with a `MongoClient` export. |
| `database/recognitionCollection.js` | Replace `db.get()` with `client.db().collection()`; update index syntax. |
| `database/goldenRecognitionCollection.js` | Same collection swap; also replace `insert()` with `insertOne()` and add `.catch()` on init call. |
| `database/deductionCollection.js` | Replace `db.get()` with `client.db().collection()`; update index syntax. |
| `service/recognition.js` | Replace `find()` → `.toArray()`, `count()` → `countDocuments()`, `insert()` → `insertOne()`. |
| `service/balance.js` | Replace `count()` → `countDocuments()`, `find()` → `.find().toArray()`. |
| `service/deduction.js` | Replace `insert()` → `insertOne()`, `find()` → `.find().toArray()`, `monk.id()` → `new ObjectId()`; remove `monk` import. |
| `service/report.js` | Replace `count()` → `countDocuments()`, add `.toArray()` to `aggregate()` cursor (not in spec but required). |
| `test/service/recognition.js` | Update `insert` stubs to `insertOne`; update `count` stubs to `countDocuments`. |
| `test/service/balance.js` | Update `find` stubs to cursor-like objects; update `count` stubs to `countDocuments`. |
| `test/service/deduction.js` | Update `insert` stubs to `insertOne`; update `find` stubs to cursor-like objects; remove `monk` import; update `monk.id()` assertion to `new ObjectId()`. |
| `app.js` | Import `client`; add `client.connect()`; add startup try/catch; remove vestigial port arg; implement `/health` database check. |
| `infra/terraform/cosmosdb.tf` | Add `mongo_server_version = "4.2"` to the `azurerm_cosmosdb_account` resource. |
| `AGENTS.md` | Update stack description and `database/` comment to remove Monk references. |
| `docs/ARCHITECTURE.md` | Update stack blurb, Layer 3 description, and `db.js` table row to reflect native driver. |
| `docs/TESTING.md` | Update stubbing examples: `find` → cursor pattern, `insert` → `insertOne`, remove Monk wording. |
| `AUDIT_ISSUES.md` | Check off the two M5 checklist items once the migration is complete. |

### Notes

- Run `npm run test-n-lint` before each commit to satisfy the pre-commit hook.
- Cursor-like stubs for `find` follow this pattern: `sinon.stub(collection, "find").returns({ toArray: sinon.stub().resolves([...]) })` — note `.returns()` not `.resolves()`.
- The `aggregate()` cursor fix in `service/report.js` is not listed in the spec but is required: Monk resolves `aggregate()` to an array; the native driver returns a cursor. Add `.toArray()` after `aggregate([...])`.
- `infra/` changes do not auto-apply. A human must approve the GitHub Actions workflow before they affect real resources.
- All commits on this work must use a feature branch — direct pushes to `main` are blocked.

---

## Tasks

### [x] 1.0 Replace Monk with Native MongoClient in the Database Layer

**Goal:** Swap the `monk` package for the official `mongodb` v6 driver in all
`database/` files. After this task the rest of the codebase can still import
collections as before, but no Monk API surface remains in the `database/`
directory.

#### 1.0 Proof Artifact(s)

- CLI: `npm install` output shows `mongodb@6.x` present and `monk` absent in
  `node_modules/` — demonstrates the dependency swap is complete.
- CLI: `npm test` exits 0 after the database layer change (before service layer
  changes) — demonstrates collection modules are still importable and existing
  stubs do not break at this stage.
- Code: `grep -r "monk" database/` returns no matches — demonstrates no Monk
  API remains in the layer.

#### 1.0 Tasks

- [x] 1.1 Create a feature branch: `git checkout -b chore/monk-to-mongodb-driver`
- [x] 1.2 Run `npm install mongodb && npm uninstall monk` to swap the dependency; verify `package.json` shows `mongodb` in `dependencies` and `monk` is removed.
- [x] 1.3 Rewrite `database/db.js`: import `{ MongoClient }` from `'mongodb'`, remove the `monk` import, create `const client = new MongoClient(mongo_url)`, and export `client` (replacing the current `module.exports = monk(mongo_url)`).
- [x] 1.4 Update `database/recognitionCollection.js`: replace `db.get('recognition')` with `client.db().collection('recognition')` (where `db` is now the imported `client`); change all three `createIndex` calls from string syntax (e.g., `createIndex('recognizer')`) to object syntax (e.g., `createIndex({ recognizer: 1 })`).
- [x] 1.5 Update `database/deductionCollection.js`: same changes as 1.4 — replace `db.get('deduction')` with `client.db().collection('deduction')` and convert all `createIndex` calls to object syntax.
- [x] 1.6 Update `database/goldenRecognitionCollection.js`: replace `db.get('goldenrecognition')` with `client.db().collection('goldenrecognition')`; convert `createIndex` calls to object syntax; replace `goldenRecognitionCollection.insert(collectionValues)` with `goldenRecognitionCollection.insertOne(collectionValues)` in `initializeGoldenRecognitionCollection`; add `.catch((e) => winston.error("Failed to initialize golden recognition collection", { func: "initializeGoldenRecognitionCollection", error: e.message }))` on the `initializeGoldenRecognitionCollection()` call at the bottom of the file.
- [x] 1.7 Run `npm test` and confirm all tests pass; confirm `grep -r "monk" database/` returns no matches.

---

### [x] 2.0 Update All Query and Write Call Sites in the Service Layer

**Goal:** Replace every Monk-specific method call (`find`, `count`, `insert`,
`monk.id()`, `aggregate`) in `service/` with the native driver equivalents, and
update all corresponding test stubs to match the new cursor-based `find()` and
`aggregate()` return types.

#### 2.0 Proof Artifact(s)

- CLI: `npm test` exits 0 after all service and test stub updates — demonstrates
  the new call patterns are correctly implemented and all stubs are aligned.
- Code: `grep -r "monk" service/` returns no matches — demonstrates no Monk
  import or API call remains in the service layer.
- Code: `grep -rn "\.find(" service/` shows every call site appends `.toArray()`
  — demonstrates cursor-based returns are handled everywhere.

#### 2.0 Tasks

- [x] 2.1 Update `service/recognition.js`:
  - Line 50: `goldenRecognitionCollection.insert(collectionValues)` → `goldenRecognitionCollection.insertOne(collectionValues)`
  - Line 52: `recognitionCollection.insert(collectionValues)` → `recognitionCollection.insertOne(collectionValues)`
  - Line 74: `recognitionCollection.count(filter)` → `recognitionCollection.countDocuments(filter)`
  - Line 96: `recognitionCollection.count(filter)` → `recognitionCollection.countDocuments(filter)`
  - Line 153: `recognitionCollection.find(filter)` → `recognitionCollection.find(filter).toArray()`
- [x] 2.2 Update `service/balance.js`:
  - Line 25: `recognitionCollection.count({ recognizee: user })` → `recognitionCollection.countDocuments({ recognizee: user })`
  - Line 26: `goldenRecognitionCollection.count({ recognizee: user })` → `goldenRecognitionCollection.countDocuments({ recognizee: user })`
  - Line 31: `deductionCollection.find({ user, refund: false })` → `deductionCollection.find({ user, refund: false }).toArray()`
  - Line 45: `recognitionCollection.count({...})` → `recognitionCollection.countDocuments({...})`
- [x] 2.3 Update `service/deduction.js`:
  - Remove `const monk = require('monk')` (line 5).
  - Add `const { ObjectId } = require('mongodb')` at the top of the file.
  - Line 17: `deductionCollection.insert({...})` → `deductionCollection.insertOne({...})`
  - Line 28: `{ _id: monk.id(id) }` → `{ _id: new ObjectId(id) }`
  - Line 51: `deductionCollection.find(filter)` → `deductionCollection.find(filter).toArray()`
- [x] 2.4 Update `service/report.js`:
  - Line 43: `recognitionCollection.aggregate([...])` → `recognitionCollection.aggregate([...]).toArray()` (the native driver returns a cursor from `aggregate()`; Monk resolved it to an array directly)
  - Line 114: `recognitionCollection.count(filter)` → `recognitionCollection.countDocuments(filter)`
- [x] 2.5 Update `test/service/balance.js`:
  - All `sinon.stub(deductionCollection, "find").resolves([...])` → `.returns({ toArray: sinon.stub().resolves([...]) })`
  - All `sinon.stub(recognitionCollection, "count")` → `sinon.stub(recognitionCollection, "countDocuments")`
  - All `sinon.stub(goldenRecognitionCollection, "count")` → `sinon.stub(goldenRecognitionCollection, "countDocuments")`
- [x] 2.6 Update `test/service/deduction.js`:
  - Remove `const monk = require('monk')` import (line 2).
  - Add `const { ObjectId } = require('mongodb')` import.
  - All `sinon.stub(deductionCollection, "insert")` → `sinon.stub(deductionCollection, "insertOne")`
  - All `sinon.stub(deductionCollection, "find").resolves([...])` → `.returns({ toArray: sinon.stub().resolves([...]) })`
  - In the `refundDeduction` test, update the `calledWith` assertion: replace `monk.id("62171d78b5daaa0011771cfd")` with `new ObjectId("62171d78b5daaa0011771cfd")`.
- [x] 2.7 Update `test/service/recognition.js`:
  - Any `sinon.stub(goldenRecognitionCollection, "insert")` (e.g., line 77) → `sinon.stub(goldenRecognitionCollection, "insertOne")`
  - Any `sinon.stub(recognitionCollection, "count")` → `sinon.stub(recognitionCollection, "countDocuments")`
  - Any `sinon.stub(recognitionCollection, "find").resolves([...])` → `.returns({ toArray: sinon.stub().resolves([...]) })`
- [x] 2.8 Run `npm test` and confirm all tests pass; confirm `grep -r "monk" service/` returns no matches.

---

### [x] 3.0 Wire App Startup, Database Health Check, and Infrastructure

**Goal:** Add explicit connection management to `app.js`, implement the
`/health` database check (resolving the `// TODO` at lines 51–53), and pin the
CosmosDB MongoDB API version in Terraform.

#### 3.0 Proof Artifact(s)

- HTTP: `GET /health` response body includes `"database": "OK"` when the bot is
  running with a reachable MongoDB — demonstrates the health check now covers
  database connectivity.
- CLI: `npm test` exits 0 after startup changes — demonstrates the app startup
  refactor did not break anything.
- Diff: `infra/terraform/cosmosdb.tf` contains `mongo_server_version = "4.2"` —
  demonstrates the API version is pinned in source control.
- CI: `terraform plan` step in PR shows 0 resources to add, change, or destroy
  — demonstrates the version pin is a no-op on the existing account.

#### 3.0 Tasks

- [x] 3.1 In `app.js`, import the `client` exported from `database/db.js` (add `const client = require('./database/db')`).
- [x] 3.2 Wrap the startup IIFE body in `try { ... } catch (e) { winston.error("Startup failed", { error: e.message }); process.exit(1); }`.
- [x] 3.3 At the very top of the IIFE's `try` block — before features are loaded and before `app.start()` — add `await client.connect()`.
- [x] 3.4 Change `await app.start(3000)` to `await app.start()` (remove the vestigial port argument; socket mode does not bind an HTTP port).
- [x] 3.5 Replace the `// Check Database Connection` TODO block in the `/health` handler (lines 51–53) with:
  ```javascript
  try {
    await client.db().command({ ping: 1 });
    status_checks.database = "OK";
  } catch (e) {
    status_checks.database = e.message;
  }
  ```
- [x] 3.6 In `infra/terraform/cosmosdb.tf`, add `mongo_server_version = "4.2"` inside the `azurerm_cosmosdb_account "db_account"` resource block (before the `automatic_failover_enabled` line is fine; keep it visually grouped with the other account-level settings).
- [x] 3.7 Run `npm test` and confirm all tests pass.
- [ ] 3.8 Open a pull request from the feature branch. Confirm the CI `terraform plan` step reports 0 resources to add, change, or destroy for the `mongo_server_version` addition.

---

### [ ] 4.0 Update Repository Documentation to Reflect the Native Driver

**Goal:** Remove all stale Monk references from checked-in documentation so that
`AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md` accurately describe
the post-migration codebase, and mark the M5 checklist items in `AUDIT_ISSUES.md`
as resolved.

#### 4.0 Proof Artifact(s)

- Code: `grep -r "Monk\|monk" AGENTS.md docs/ARCHITECTURE.md docs/TESTING.md` returns no matches (excluding the word "MongoDB") — demonstrates all stale references are removed.
- Diff: PR diff shows the four doc files updated with accurate native-driver descriptions and examples.

#### 4.0 Tasks

- [ ] 4.1 Update `AGENTS.md`:
  - Line 22: `MongoDB (via Monk), Winston logging` → `MongoDB (native driver), Winston logging`
  - Line 68 comment: `# Monk collection definitions and MongoDB connection` → `# MongoDB collection definitions and connection`
- [ ] 4.2 Update `docs/ARCHITECTURE.md`:
  - Line 11: `MongoDB (via Monk) is the only datastore.` → `MongoDB (native \`mongodb\` driver) is the only datastore.`
  - Lines 73–74: Replace `Monk collection definitions and the MongoDB connection. Each collection file exports a Monk collection object used directly by services.` with `MongoDB collection definitions and the connection. Each collection file exports a native Collection object used directly by services.`
  - Line 78 table row for `db.js`: change the description from `Connection singleton (\`monk(config.mongo_url)\`)` to `Connection singleton (\`new MongoClient(config.mongo_url)\`)`
- [ ] 4.3 Update `docs/TESTING.md`:
  - Line 103: Change `stub the Monk method you need:` to `stub the collection method you need:`
  - Lines 111–112: Update the `find` stub example from `.resolves([...])` to the cursor pattern: `sinon.stub(recognitionCollection, "find").returns({ toArray: sinon.stub().resolves([{ recognizer: "U001", ... }]) })`
  - Line 127: Change `sinon.stub(goldenRecognitionCollection, "insert").resolves({})` to `sinon.stub(goldenRecognitionCollection, "insertOne").resolves({})`
  - Line 130: Change `sinon.stub(recognitionCollection, "insert").resolves({ _id: "fake-id" })` to `sinon.stub(recognitionCollection, "insertOne").resolves({ acknowledged: true, insertedId: "fake-id" })`
  - Lines 140–142: Update the `.onCall()` `find` stub example to use the cursor pattern: `.returns({ toArray: sinon.stub().resolves([...]) })` for each call
- [ ] 4.4 Update `AUDIT_ISSUES.md`: locate the two unchecked M5 checklist items (lines 542–543) and mark them as complete (`- [x]`).
- [ ] 4.5 Run `npm run lint` to confirm no lint issues were introduced by the doc changes (ESLint targets `*.js` only, so this is a quick sanity check that nothing else was accidentally edited).
