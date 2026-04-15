# 01-audit-monk-to-native-mongodb-driver

## Executive Summary

- Overall Status: **PASS**
- Required Gate Failures: 0
- Flagged Risks: 1

## Gateboard

| Gate | Status | Why it failed (≤10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | PASS | All FRs have mapped test artifacts | — |
| Proof artifact verifiability | PASS | All artifacts are observable and reproducible | — |
| Repository standards consistency | PASS | ≥2 sources read; no conflicts detected | — |
| Open question resolution | PASS | Both open questions resolved by codebase inspection | — |
| Regression-risk blind spots | FLAG | `aggregate()` cursor fix has no test stub update planned | See FLAG §1 |
| Non-goal leakage | PASS | No tasks exceed spec scope | — |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Context marker 🤖; three-layer separation; `chore(deps):` commit type; `npm run test-n-lint` before committing | none |
| `CLAUDE.md` | yes | Branch from `main`; kebab-case files; async/await throughout; Winston for errors | none |
| `docs/ARCHITECTURE.md` | yes | `database/` exports collections; `service/` imports them; no cross-layer Monk in service after migration | none |
| `docs/TESTING.md` | yes | Mocha/Chai/Sinon; `sinon.stub(...).resolves(...)`; `afterEach(() => sinon.restore())` | none |
| `package.json` | yes | `npm test` = mocha+nyc; `npm run test-n-lint` = test+lint; lint targets `*.js features/** service/** test/**` | none |
| `CONTRIBUTING.md` | not found | — | — |
| `.github/pull_request_template.md` | not found | — | — |

## Open Question Resolutions (Documented Assumptions)

Both open questions from the spec were resolved by reading the codebase before
sub-task generation:

1. **`findOneAndUpdate` return shape**: `service/refund.js` calls
   `await deduction.refundDeduction(messageText[2])` and does **not** use the
   return value. The native driver default of `returnDocument: 'before'` is
   therefore safe. No `{ returnDocument: 'after' }` option needed.

2. **`insertOne` return value**: Test stubs for `createDeduction` and
   `giveRecognition` assert on call arguments only, not return shapes. No caller
   depends on Monk's document-return shape. The `{ acknowledged, insertedId }`
   result from `insertOne` requires no adaptation at call sites.

## FLAG Findings

### 1. `aggregate()` cursor in `service/report.js` has no corresponding test stub update

- **Risk:** Task 2.4 adds `.toArray()` to `recognitionCollection.aggregate(...)`,
  but Tasks 2.5–2.7 (test stub updates) only cover `find`, `count`/`countDocuments`,
  and `insert`/`insertOne`. If a test for `getTopMessagesForUser` stubs
  `aggregate` and relies on Monk's array-resolution behaviour, that test will
  fail after 2.4 lands.
- **Suggested remediation:** Check `test/service/` for any stub of
  `recognitionCollection.aggregate`. If one exists, update it to return
  `{ toArray: sinon.stub().resolves([...]) }` and add a sub-task (2.7a) under
  Task 2.0 to capture this. If no test currently covers `aggregate`, note it but
  no stub change is needed.

> **Note:** Inspection of the test file list shows no `test/service/report.js`
> exists in the repository. `service/report.js` is the only service file without
> a corresponding test. The aggregate cursor risk therefore affects runtime only,
> not the test suite. The FLAG remains because a gap in coverage exists; it does
> not block implementation.

## User-Approved Remediation Plan

- Approved

## Re-Audit Delta (Run 2)

- Changed gate statuses since previous run: none — all REQUIRED gates were already passing.
- Still-failing REQUIRED gates: none.
- Newly introduced findings: none.
- Task 4.0 added to cover documentation updates (`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `AUDIT_ISSUES.md`). Relevant files table updated accordingly. FLAG §1 is unchanged (no test file for `service/report.js` exists; runtime risk only).
