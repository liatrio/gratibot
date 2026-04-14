# Task 04 Proofs - Documentation updated, AUDIT_ISSUES.md M5 items resolved

## Task Summary

This task removed all stale Monk references from `AGENTS.md`, `docs/ARCHITECTURE.md`,
and `docs/TESTING.md`, replacing them with accurate native-driver descriptions and
updated stub examples. The two M5 checklist items in `AUDIT_ISSUES.md` were marked
complete.

## What This Task Proves

- `AGENTS.md` stack blurb and `database/` comment no longer mention Monk.
- `docs/ARCHITECTURE.md` datastore line, Layer 3 description, and `db.js` table row
  reflect the native `MongoClient`.
- `docs/TESTING.md` stub examples use `insertOne`, the cursor pattern for `find`,
  and the `.onCall()` cursor pattern.
- `AUDIT_ISSUES.md` M5 items are checked off.
- `npm run lint` exits 0 — no JS was accidentally broken by the doc edits.

## Evidence Summary

- `grep -ri "monk" AGENTS.md docs/ARCHITECTURE.md docs/TESTING.md | grep -iv "mongodb\|MongoClient"` returns no output (exit 1).
- `npm run lint` exits 0 with no output.

---

## Artifact: No stale Monk references in doc files

**What it proves:** All Monk-specific wording has been removed from the three doc files.

**Why it matters:** Future contributors reading these files will see accurate native-driver
guidance instead of stale Monk patterns.

**Command:**

```bash
grep -ri "monk" AGENTS.md docs/ARCHITECTURE.md docs/TESTING.md | grep -iv "mongodb\|MongoClient"
# (returns no output — exit code 1)
```

**Result summary:** Zero matches. The only remaining occurrences of "mongo" in those files
refer to MongoDB or MongoClient, which are correct.

---

## Artifact: Lint passes cleanly

**What it proves:** No `.js` file was accidentally modified during doc editing.

**Command:**

```bash
npm run lint
```

**Result summary:** ESLint exited 0 with no output — no lint issues introduced.

---

## Artifact: Key doc changes

**AGENTS.md line 22:**
```
Before: MongoDB (via Monk), Winston logging
After:  MongoDB (native driver), Winston logging
```

**AGENTS.md line 68:**
```
Before: # Monk collection definitions and MongoDB connection
After:  # MongoDB collection definitions and connection
```

**docs/ARCHITECTURE.md line 11:**
```
Before: MongoDB (via Monk) is the only datastore.
After:  MongoDB (native `mongodb` driver) is the only datastore.
```

**docs/ARCHITECTURE.md lines 73–74:**
```
Before: Monk collection definitions and the MongoDB connection. Each collection file exports a
        Monk collection object used directly by services.
After:  MongoDB collection definitions and the connection. Each collection file exports a
        native Collection object used directly by services.
```

**docs/ARCHITECTURE.md db.js table row:**
```
Before: Connection singleton (`monk(config.mongo_url)`)
After:  Connection singleton (`new MongoClient(config.mongo_url)`)
```

**docs/TESTING.md — find stub example:**
```javascript
// Before
sinon.stub(recognitionCollection, "find").resolves([...]);

// After
sinon.stub(recognitionCollection, "find").returns({ toArray: sinon.stub().resolves([...]) });
```

**docs/TESTING.md — insert stub examples:**
```javascript
// Before
sinon.stub(goldenRecognitionCollection, "insert").resolves({});
sinon.stub(recognitionCollection, "insert").resolves({ _id: "fake-id" });

// After
sinon.stub(goldenRecognitionCollection, "insertOne").resolves({});
sinon.stub(recognitionCollection, "insertOne").resolves({ acknowledged: true, insertedId: "fake-id" });
```

**docs/TESTING.md — .onCall() examples:**
```javascript
// Before
stub.onFirstCall().resolves([/* recognitions given */]);
stub.onSecondCall().resolves([/* recognitions received */]);

// After
stub.onFirstCall().returns({ toArray: sinon.stub().resolves([/* recognitions given */]) });
stub.onSecondCall().returns({ toArray: sinon.stub().resolves([/* recognitions received */]) });
```

**AUDIT_ISSUES.md lines 542–543:** Both M5 checklist items changed from `[ ]` to `[x]`.

---

## Reviewer Conclusion

All four documentation files now accurately describe the post-migration codebase. No
Monk references remain in `AGENTS.md`, `docs/ARCHITECTURE.md`, or `docs/TESTING.md`.
The M5 audit items are resolved. Lint passes cleanly.
