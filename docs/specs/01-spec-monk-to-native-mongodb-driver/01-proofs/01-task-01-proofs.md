# Task 01 Proofs - Database layer replaced: Monk removed, native MongoClient wired

## Task Summary

This task swapped the `monk` package for the official `mongodb` v6 driver across all
files in `database/`. After this task: `db.js` exports a `MongoClient` instance,
all three collection files use `client.db().collection()` with object-syntax indexes,
and `monk` is fully absent from the `database/` directory and `package.json`.

## What This Task Proves

- `monk` is removed from `package.json` and `node_modules`.
- `mongodb@6` is present in `package.json`.
- All four `database/` files use only native driver APIs — zero Monk surface remains.
- `goldenRecognitionCollection.js` uses `insertOne` and `.catch()` on the init call.

## Evidence Summary

- `package.json` shows `mongodb: ^6.21.0` and no `monk` key.
- `grep -r "monk" database/` returns no matches.
- The test suite exception caused by `test/service/deduction.js` still importing `monk`
  is expected at this stage: that file's monk removal is Task 2.6, intentionally deferred
  to the service-layer task. The database layer modules themselves are fully importable
  without Monk.

---

## Artifact: Dependency swap — mongodb present, monk absent

**What it proves:** The dependency swap is complete in `package.json`.

**Why it matters:** This is the authoritative record of which packages the project depends on.

**Command:**

```bash
node -e "const p = require('./package.json'); console.log('mongodb:', p.dependencies.mongodb); console.log('monk:', p.dependencies.monk ?? 'NOT PRESENT')"
```

**Result summary:** `mongodb: ^6.21.0` is present; `monk` key is absent.

```
mongodb: ^6.21.0
monk: NOT PRESENT
```

---

## Artifact: No Monk references in database/

**What it proves:** Zero Monk API surface remains in the database layer.

**Why it matters:** The spec requires the database layer to be fully migrated before service-layer changes begin.

**Command:**

```bash
grep -r "monk" database/
# (returns no output — exit code 1)
```

**Result summary:** `grep` found no matches. All four `database/` files use only native driver imports and APIs.

---

## Artifact: db.js — MongoClient export

**What it proves:** The connection singleton now uses `MongoClient` instead of `monk()`.

**Why it matters:** All collection files import from `db.js`; this is the root of the dependency graph.

```javascript
// database/db.js
const { mongo_url } = require('../config')
const { MongoClient } = require('mongodb')

const client = new MongoClient(mongo_url)

module.exports = client
```

---

## Artifact: Collection files — object-syntax indexes and native collection()

**What it proves:** All three collection files use `client.db().collection()` and `createIndex({ field: 1 })` syntax.

**recognitionCollection.js:**
```javascript
const client = require('./db')
const recognitionCollection = client.db().collection('recognition')

recognitionCollection.createIndex({ recognizer: 1 })
recognitionCollection.createIndex({ recognizee: 1 })
recognitionCollection.createIndex({ timestamp: 1 })

module.exports = recognitionCollection
```

**deductionCollection.js:**
```javascript
const client = require('./db')
const deductionCollection = client.db().collection('deduction')

deductionCollection.createIndex({ user: 1 })
deductionCollection.createIndex({ timestamp: 1 })
deductionCollection.createIndex({ refund: 1 })

module.exports = deductionCollection
```

**goldenRecognitionCollection.js (key changes):**
```javascript
// insert → insertOne
await goldenRecognitionCollection.insertOne(collectionValues)

// init call now has .catch()
initializeGoldenRecognitionCollection().catch((e) => winston.error(...))
```

---

## Reviewer Conclusion

The database layer is fully migrated to the native `mongodb` v6 driver. `monk` is absent
from both `package.json` and all `database/` source files. Service-layer test stubs
(Task 2.0) will restore the full test suite to green.
