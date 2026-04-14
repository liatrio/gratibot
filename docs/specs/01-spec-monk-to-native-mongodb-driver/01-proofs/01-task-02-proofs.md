# Task 02 Proofs - Service layer migrated: all Monk call sites replaced with native driver equivalents

## Task Summary

This task replaced every Monk-specific method call in the `service/` directory with its
native driver equivalent and updated all corresponding test stubs to match the new
cursor-based `find()` and `aggregate()` return types. After this task the entire test
suite passes with zero failures.

## What This Task Proves

- `insert` → `insertOne` in `service/recognition.js` and `service/deduction.js`.
- `count` → `countDocuments` in `service/recognition.js`, `service/balance.js`, and `service/report.js`.
- `find(...)` → `find(...).toArray()` in `service/recognition.js`, `service/balance.js`, and `service/deduction.js`.
- `aggregate([...])` → `aggregate([...]).toArray()` in `service/report.js`.
- `monk.id(id)` → `new ObjectId(id)` and `const monk = require('monk')` removed in `service/deduction.js`.
- All test stubs in `test/service/` aligned with new method names and cursor pattern.
- 117 tests pass, 0 failures.

## Evidence Summary

- `npm test` exits 0 with 117 passing, 0 failing — the full suite is green.
- `grep -r "monk" service/` returns no output (exit code 1) — no Monk API remains.
- `grep -rn ".find(" service/` shows all collection `.find()` calls append `.toArray()`.

---

## Artifact: Full test suite — 117 passing, 0 failing

**What it proves:** The service and test stub updates are correct and do not break any existing tests.

**Why it matters:** This is the primary quality gate for Task 2.0. Green tests confirm both
the new method names and the cursor-pattern stubs work end-to-end.

**Command:**

```bash
npm test
```

**Result summary:** 117 tests passing in 72ms. 0 failures.

```
117 passing (72ms)
```

---

## Artifact: No Monk references in service/

**What it proves:** Zero Monk imports or API calls remain in the service layer.

**Why it matters:** Confirms the migration is complete — no Monk surface can be called at runtime.

**Command:**

```bash
grep -r "monk" service/
# (returns no output — exit code 1)
```

**Result summary:** `grep` found no matches across all service files.

---

## Artifact: All collection find() calls use .toArray()

**What it proves:** Every MongoDB collection `.find()` call now returns a resolved array,
not a Monk-auto-resolved array.

**Why it matters:** The native driver returns a cursor from `.find()`; callers must call
`.toArray()` explicitly. This confirms no call site was missed.

**Command:**

```bash
grep -rn "\.find(" service/
```

**Result summary:** The three collection find calls all append `.toArray()`. The remaining
`.find(` matches on lines 223/230/233 of `recognition.js` are JavaScript `Array.prototype.find`
calls on in-memory arrays — unrelated to the database driver.

```
service/deduction.js:51:  return await deductionCollection.find(filter).toArray();
service/recognition.js:153:  return await recognitionCollection.find(filter).toArray();
service/balance.js:31:  const deductions = await deductionCollection.find({ user, refund: false }).toArray();
```

---

## Artifact: Key service file changes (summary)

**service/recognition.js** — `insertOne`, `countDocuments`, `.find().toArray()`

```javascript
// Before → After
goldenRecognitionCollection.insert(...)  → goldenRecognitionCollection.insertOne(...)
recognitionCollection.insert(...)        → recognitionCollection.insertOne(...)
recognitionCollection.count(filter)      → recognitionCollection.countDocuments(filter)
recognitionCollection.find(filter)       → recognitionCollection.find(filter).toArray()
```

**service/balance.js** — `countDocuments`, `.find().toArray()`

```javascript
recognitionCollection.count(...)         → recognitionCollection.countDocuments(...)
goldenRecognitionCollection.count(...)   → goldenRecognitionCollection.countDocuments(...)
deductionCollection.find(...).toArray()
recognitionCollection.countDocuments(...)
```

**service/deduction.js** — `ObjectId`, `insertOne`, `.find().toArray()`

```javascript
// Removed: const monk = require('monk')
// Added:   const { ObjectId } = require('mongodb')
deductionCollection.insert(...)          → deductionCollection.insertOne(...)
{ _id: monk.id(id) }                    → { _id: new ObjectId(id) }
deductionCollection.find(filter)         → deductionCollection.find(filter).toArray()
```

**service/report.js** — `aggregate().toArray()`, `countDocuments`

```javascript
recognitionCollection.aggregate([...])           → recognitionCollection.aggregate([...]).toArray()
recognitionCollection.count(filter)              → recognitionCollection.countDocuments(filter)
```

---

## Reviewer Conclusion

The service layer is fully migrated. All Monk method calls have been replaced with native
driver equivalents, all test stubs use the cursor pattern, and the full test suite passes
with 117 tests and 0 failures.
