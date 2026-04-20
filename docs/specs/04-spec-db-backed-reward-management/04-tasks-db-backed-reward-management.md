# 04-tasks-db-backed-reward-management.md

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `database/rewardCollection.js` | **NEW.** Defines the `rewards` MongoDB collection and its indexes (`{active:1, sortOrder:1}` and `{sortOrder:1, name:1}`). Mirrors existing `recognitionCollection.js` / `deductionCollection.js`. |
| `service/rewardSeed.js` | **NEW.** Exports a `seedRewards()` function called from `app.js` at startup. Unit 1: reads `rewards.json`, adds `kind: "liatrio-store"` to the Liatrio Store entry, inserts when empty. Unit 4: reduced to an inline single-entry seed. |
| `test/service/rewardSeed.js` | **NEW.** Mocha/Chai/Sinon tests for seed idempotency, the `kind: "liatrio-store"` marker, and (after Unit 4) the reduced inline seed. |
| `service/redeem.js` | **MODIFY.** Replace the top-level `fs.readFileSync(rewards.json)` with an async `createRedeemBlocks(currentBalance)` that reads from `rewardCollection`, filters `active: true`, and sorts ascending by `sortOrder` then `name`. Selected-item payload gains `kind`. |
| `test/service/redeem.js` | **MODIFY.** Stub `rewardCollection.find(...).sort(...).toArray()`. Add cases for active-only filter, sort order with tiebreak, and `kind` presence in the select-option `value`. |
| `features/redeem.js` | **MODIFY.** Tighten the user-facing matcher so `admin redeem` does not fire it; branch on `kind === "liatrio-store"` instead of `itemName === "Liatrio Store"`; await the now-async `createRedeemBlocks`. |
| `test/features/redeem.js` | **NEW.** Feature-layer specs using `test/mocks/bolt-app.js` to assert (a) matcher does not fire on `admin redeem`, (b) `redeemItem` branches on `kind`. |
| `app.js` | **MODIFY.** Invoke `seedRewards()` after `client.connect()` and before the feature-module loader loop. Log seed outcome via Winston. |
| `service/rewardAdmin.js` | **NEW.** CRUD + validation + authorization for the admin surface: `isAuthorized(userId)`, `listRewards()`, `createReward(input, actor)`, `updateReward(id, input, actor)`, `softDeleteReward(id, actor)`, `validateReward(input)`, Block Kit builders for the main view, add form, and edit form. Unit 3 also owns `resolveUploadedImageURL(fileRef, client)`. |
| `test/service/rewardAdmin.js` | **NEW.** Unit tests for all of the above including each validation branch, the upload-flow success/failure cases (Unit 3), and Block Kit structure for the three views. |
| `features/reward-admin.js` | **NEW.** Registers `app.message(/^\s*admin\s+redeem\s*$/i, ...)` for DM + directMention, the `block_actions` handlers for `reward_admin_add`, `reward_admin_edit`, `reward_admin_softdelete`, and the `view_submission` handlers for the Add and Edit views. Re-checks authorization on every `view_submission`. |
| `test/features/reward-admin.js` | **NEW.** Feature-layer specs using `test/mocks/bolt-app.js` covering non-admin rejection, admin modal-open, edit/add `views.update`, submit round-trip to list view, and `view_submission` auth re-check rejecting non-admin replay. |
| `rewards.json` | **MODIFY then DELETE.** Unit 1 is the last reader of this file (via the seed). Unit 4 deletes it. |
| `slack_app_manifest.yml` | **MODIFY.** Unit 3 adds `files:read` and `files:write` to `oauth_config.scopes.bot`. |
| `docs/DEVELOPMENT.md` | **MODIFY.** Unit 3 adds a note that local dev apps must be reinstalled after the scope change. |
| `config.js` | **READ ONLY** unless new tunables are needed. `config.redemptionAdmins` is reused for the authorization gate. Do not edit the Slack user ID list or its comments. |
| `docs/specs/04-spec-db-backed-reward-management/04-proofs/` | **NEW directory.** Destination for all proof artifacts captured across Units 1–5. Must contain no secrets, tokens, or real Slack file content. |
| `docs/specs/04-spec-db-backed-reward-management/04-audit-db-backed-reward-management.md` | **NEW.** Planning audit report produced by Phase 4 of this skill. |

### Notes

- **Branch naming:** work lands on a single `feat/04-db-backed-rewards` branch; each parent task (Units 1–4) ends in one Conventional Commit. Unit 5 is a final verification pass (docs-only commit if anything). Do not squash at merge — preserve per-unit commits.
- **Test locations:** `test/` mirrors source (`test/service/*.js`, `test/features/*.js`). Use `describe`/`it` with `function` form (no arrow functions — ESLint `mocha/no-mocha-arrows` enforces this). `sinon.restore()` in `afterEach`.
- **Mongo stubbing convention:** stub the collection method and return a chainable shape (`returns({ sort: sinon.stub().returns({ toArray: sinon.stub().resolves([...]) }) })`) so service code can use `find().sort().toArray()` without hitting Mongo.
- **Winston logging:** every new function in `service/` and `features/` logs with `{ func, callingUser, rewardId, ... }` context (per `docs/ARCHITECTURE.md` → Logging).
- **Layer discipline:** services must not import `@slack/bolt` types or touch `client.views.*`; features must not import `database/*`. Block Kit builders live in `service/rewardAdmin.js`; the feature layer only calls them and passes the result to `client.views.open` / `client.views.update`.
- **Pre-commit:** `npm run lint` and `npm test` pass before every commit; husky hook will also run `lint`.
- **Unit 3 spike-first:** run the `files.sharedPublicURL` probe before writing Unit 3 code. If the probe fails (per spec §Technical Considerations → Image Handling), drop the upload path for v1 — keep the plain-text `imageURL` field from Unit 2, skip the manifest scope change, and move the upload work into a follow-up spec. Document the decision in `04-proofs/3.0-spike.md`.

## Tasks

### [ ] 1.0 Database-backed reward catalog + startup seeding + DB-backed redeem (Unit 1)

Move the reward catalog source of truth from `rewards.json` into a new MongoDB `rewards`
collection. Introduce `database/rewardCollection.js` (with `{active:1, sortOrder:1}` and
`{sortOrder:1, name:1}` indexes), `service/rewardSeed.js` (idempotent seed from
`rewards.json` including the `kind: "liatrio-store"` marker on the Liatrio Store entry),
and refactor `service/redeem.js::createRedeemBlocks` and
`features/redeem.js::redeemItem` to read from the DB and branch on `kind` rather than
the display name. End-user redeem UX is byte-identical. Invoked from `app.js` after
`client.connect()` and before feature registration. Commit: `feat(redeem): migrate reward
catalog to MongoDB with startup seeding`.

#### 1.0 Proof Artifact(s)

- Test: `npm test` passes with new `test/service/redeem.js` cases asserting
  `createRedeemBlocks` filters `active: false` rewards, sorts ascending by `sortOrder`
  with a name tiebreak, and produces the same Block Kit shape as today's JSON-backed
  version for equivalent data. Captured as `04-proofs/1.0-test-output.txt`.
- Test: `npm test` passes with new `test/service/rewardSeed.js` cases covering
  seed-runs-when-empty, seed-does-not-run-when-non-empty, and the Liatrio Store entry
  receiving `kind: "liatrio-store"`. Captured as `04-proofs/1.0-test-output.txt`.
- Test: `npm test` passes with new `test/features/redeem.js` case asserting
  `redeemItem` branches on `kind === "liatrio-store"` (not on `itemName === "Liatrio
  Store"`). Captured as `04-proofs/1.0-test-output.txt`.
- Screenshot: DM `redeem` to dev Gratibot renders the same header, help text, item
  list, and static-select as before the change — demonstrates end-user parity. Captured
  as `04-proofs/1.0-end-user-redeem.png`.
- Mongo: `db.rewards.countDocuments({})` equals `rewards.json.length` after first
  startup against an empty DB; rerunning startup does not change the count —
  demonstrates seed correctness and idempotency. Captured as `04-proofs/1.0-seed-counts.txt`.
- CLI: `git diff main...<branch> -- service/redeem.js features/redeem.js
  database/rewardCollection.js service/rewardSeed.js app.js` shows the layer-separated
  wiring with no Slack event shapes leaking into the service layer. Captured as
  `04-proofs/1.0-diff.patch`.

#### 1.0 Tasks

- [ ] 1.1 Create the feature branch from an up-to-date `main`: `git checkout main && git pull && git checkout -b feat/04-db-backed-rewards`. All Unit 1–5 commits land here.
- [ ] 1.2 Create `database/rewardCollection.js` following the `database/recognitionCollection.js` pattern: import `./db`, bind `client.db().collection("rewards")`, call `createIndex({ active: 1, sortOrder: 1 })` and `createIndex({ sortOrder: 1, name: 1 })`, and `module.exports` the collection.
- [ ] 1.3 Create `service/rewardSeed.js` exporting an async `seedRewards()` function. It (a) imports `../database/rewardCollection`, `../winston`, `fs`, `path`, (b) calls `rewardCollection.countDocuments({})`, (c) if `0`, reads `../rewards.json`, builds documents with `kind: "liatrio-store"` on the `"Liatrio Store"` entry, `active: true`, `sortOrder` = array index, `createdBy/updatedBy: "system-seed"`, `createdAt/updatedAt: new Date()`, (d) calls `insertMany(docs)`, (e) logs at `info` with insert count on seed-runs, `debug` on already-seeded, (f) returns without inserting when count > 0. Never throws past the caller — log and rethrow so `app.js` can fail startup cleanly.
- [ ] 1.4 Create `test/service/rewardSeed.js`. Use `describe("service/rewardSeed", function () { ... })` with `function` form. Cases: (a) seed-runs-when-empty — stub `countDocuments` to resolve `0`, stub `insertMany` to resolve, assert `insertMany` is called with an array of 14 docs whose Liatrio Store entry has `kind: "liatrio-store"` and whose other entries have no `kind` field; (b) seed-does-not-run-when-non-empty — stub `countDocuments` to resolve `1`, assert `insertMany` is not called; (c) assert each doc has `active: true`, `createdBy: "system-seed"`, `updatedBy: "system-seed"`, and a monotonic `sortOrder` matching its position in `rewards.json`. Restore stubs in `afterEach` with `sinon.restore()`.
- [ ] 1.5 Refactor `service/redeem.js`: delete the top-of-file `fs.readFileSync(rewards.json)` + `JSON.parse`; remove the `gratibotRewards` module-level constant. Make `createRedeemBlocks(currentBalance)` async: query `rewardCollection.find({ active: true }).sort({ sortOrder: 1, name: 1 }).toArray()`, then build the same block sequence (`redeemHeader()`, `redeemHelpText(currentBalance)`, `...redeemItems(rewards)`, `redeemSelector(rewards)`) as today. Pass the DB rows into `redeemItems` / `redeemSelector` unchanged so their block output stays identical for equivalent data.
- [ ] 1.6 Update `redeemSelector` in `service/redeem.js` so each `option.value` serializes `{ name, cost, kind }` (kind may be `null`/absent). Keep `getSelectedItemDetails(selectedItem)` parsing `kind` off the payload and include it in the returned object alongside `itemName`, `itemCost`.
- [ ] 1.7 Update `test/service/redeem.js`: add a case that stubs `rewardCollection.find(...).sort(...).toArray()` returning a mixed active/inactive list with out-of-order `sortOrder` and asserts the blocks only include active rewards sorted ascending by `sortOrder` then `name`. Update the existing `getSelectedItemDetails` test to assert `kind` is parsed. Add a case asserting `option.value` includes `kind` when present.
- [ ] 1.8 Update `features/redeem.js::redeemItem` to branch on `kind === "liatrio-store"` (not `itemName === "Liatrio Store"`) using the `kind` value returned by `getSelectedItemDetails`. Keep all other message text and MPIM behavior identical.
- [ ] 1.9 Create `test/features/redeem.js` using `test/mocks/bolt-app.js`. Register the feature, pull `registrations.action[0].handler`, stub `redeem.getSelectedItemDetails` to return `{ itemName: "Liatrio Store", itemCost: 0, kind: "liatrio-store" }` and a second case returning a regular reward with `kind: null`. Assert the Liatrio-Store branch posts the Axomo-link message and does not call `deduction.createDeduction`; assert the standard branch does call `deduction.createDeduction`.
- [ ] 1.10 Update `app.js`: after `await client.connect();` and before the `fs.readdirSync(normalizedPath)` feature loader, `await require("./service/rewardSeed").seedRewards();`. If it throws, the existing outer `try/catch` already calls `process.exit(1)` — no extra handling needed.
- [ ] 1.11 Run `npm run lint` and `npm test` locally; fix any failures. Capture the passing output to `docs/specs/04-spec-db-backed-reward-management/04-proofs/1.0-test-output.txt`.
- [ ] 1.12 Start the local stack (`docker-compose up --build`) against a fresh MongoDB volume; after startup, connect via `docker exec -it gratibot-mongodb-1 mongosh` and run `use gratibot; db.rewards.find().toArray()` to confirm all 14 entries exist with `kind: "liatrio-store"` only on the Liatrio Store doc. Save the shell transcript to `04-proofs/1.0-seed-counts.txt`. Restart the container and rerun the count — save the second count to the same file to prove idempotency.
- [ ] 1.13 With the dev Gratibot running, DM `redeem` from a non-admin test account and screenshot the rendered blocks to `04-proofs/1.0-end-user-redeem.png`. Verify the header, help text, every item row, and the select-menu match the pre-change layout.
- [ ] 1.14 Capture the per-unit diff: `git diff main..HEAD -- service/redeem.js features/redeem.js database/rewardCollection.js service/rewardSeed.js app.js test/service/redeem.js test/service/rewardSeed.js test/features/redeem.js > docs/specs/04-spec-db-backed-reward-management/04-proofs/1.0-diff.patch`.
- [ ] 1.15 Stage and commit only Unit 1's files with message `feat(redeem): migrate reward catalog to MongoDB with startup seeding`. Pre-commit hook will run `npm run lint`.

### [ ] 2.0 Admin modal: authorization, list view, add, edit, soft-delete (Unit 2)

Add the Slack-native admin surface. A new `features/reward-admin.js` registers the
`admin redeem` matcher (DM + `@gratibot` directed), enforces `config.redemptionAdmins`
membership (on both `message` and every `view_submission`), opens a Block Kit modal
whose main view lists all rewards, and routes "Add", "Edit", and "Soft-delete" actions
to `client.views.update`. A new `service/rewardAdmin.js` holds CRUD, validation, and
authorization logic. `features/redeem.js` is tightened so the user-facing matcher does
not also fire for `admin redeem`. The image field is a plain-text `imageURL` input in
this unit (upload flow is Unit 3). Commit: `feat(reward-admin): add in-Slack admin
modal for reward CRUD`.

#### 2.0 Proof Artifact(s)

- Test: `npm test` passes with new `test/service/rewardAdmin.js` cases covering
  `listRewards`, `createReward`, `updateReward`, `softDeleteReward`, `validateReward`
  (happy path + each validation failure: empty `name`, empty `description`, non-integer
  or negative `cost`, non-integer `sortOrder`, empty `imageURL`), and `isAuthorized`.
  Captured as `04-proofs/2.0-test-output.txt`.
- Test: `npm test` passes with new `test/features/reward-admin.js` cases covering
  non-admin rejection with exact text `You are not authorized to manage rewards.`, admin
  modal-open path (`client.views.open` called with the list view), Edit-button
  `views.update` path, Add-submit `response_action: "update"` returns to list, and
  `view_submission` authorization re-check rejects a non-admin replay. Captured as
  `04-proofs/2.0-test-output.txt`.
- Test: updated `test/features/redeem.js` asserts the user-facing matcher does not
  fire on `admin redeem` — demonstrates disambiguation. Captured as
  `04-proofs/2.0-test-output.txt`.
- Screenshot: modal main view showing at least one active and one inactive reward
  with a visually unambiguous active/inactive indicator — demonstrates list view
  renders correctly. Captured as `04-proofs/2.0-modal-main-view.png`.
- Screenshot: modal add-reward form filled and submitted; main view rerenders with
  the new entry listed — demonstrates add path. Captured as
  `04-proofs/2.0-modal-add.png`.
- Screenshot: modal edit-reward form with Soft-delete confirmation dialog (danger
  style); after confirm, main view shows the row as inactive — demonstrates edit and
  soft-delete paths. Captured as `04-proofs/2.0-modal-edit-softdelete.png`.
- Slack: DM `admin redeem` from a non-admin account replies with exact text `You are
  not authorized to manage rewards.` and no modal opens — demonstrates the
  authorization boundary. Captured as `04-proofs/2.0-non-admin-reject.png`.

#### 2.0 Tasks

- [ ] 2.1 Create `service/rewardAdmin.js`. Export `isAuthorized(userId)` that returns `config.redemptionAdmins.includes(userId)`.
- [ ] 2.2 In `service/rewardAdmin.js` add `validateReward(input)`. Return `{ ok: true }` when `name` is non-empty string, `description` is non-empty string, `cost` is an integer `>= 0`, `sortOrder` is an integer (negatives allowed), and `imageURL` is a non-empty string. Otherwise return `{ ok: false, errors: { fieldId: "message", ... } }` using the Slack view_submission `response_action: "errors"` field-id shape (see Task 2.8 for the block IDs).
- [ ] 2.3 In `service/rewardAdmin.js` add `listRewards()` that runs `rewardCollection.find({}).sort({ sortOrder: 1, name: 1 }).toArray()` and returns all docs (both active and inactive).
- [ ] 2.4 In `service/rewardAdmin.js` add `createReward(input, actorUserId)` that calls `validateReward` (throws a `GratitudeError` with the errors map on failure), then `insertOne({ ...input, active: input.active !== false, createdBy: actorUserId, updatedBy: actorUserId, createdAt: now, updatedAt: now })`. Never sets `kind`.
- [ ] 2.5 In `service/rewardAdmin.js` add `updateReward(id, input, actorUserId)` that validates, then `updateOne({ _id: new ObjectId(id) }, { $set: { ...editableFields, updatedBy: actorUserId, updatedAt: now } })`. Does not touch `kind`, `createdBy`, or `createdAt`. Editable fields: `name`, `description`, `cost`, `imageURL`, `sortOrder`, `active`.
- [ ] 2.6 In `service/rewardAdmin.js` add `softDeleteReward(id, actorUserId)` that runs `updateOne({ _id: new ObjectId(id) }, { $set: { active: false, updatedBy: actorUserId, updatedAt: now } })`.
- [ ] 2.7 In `service/rewardAdmin.js` add `buildMainView(rewards)` returning a Block Kit `view` object (`type: "modal"`, `callback_id: "reward_admin_main"`, `title: "Manage Rewards"`, no `submit`). Blocks: a "Add new reward" button (action_id `reward_admin_add`) at top, then one `section` per reward showing `name`, `cost`, `sortOrder`, and an italicised `(inactive)` suffix when `active: false`, with an "Edit" button accessory (action_id `reward_admin_edit`, value = reward `_id`).
- [ ] 2.8 In `service/rewardAdmin.js` add `buildAddView()` and `buildEditView(reward)` returning Block Kit `view` objects (`type: "modal"`, `callback_id: "reward_admin_add_submit"` / `"reward_admin_edit_submit"`, `submit: { text: "Save" }`, `close: { text: "Cancel" }`). Inputs (stable `block_id`s so `view.state.values` is predictable): `name` (plain_text_input), `description` (multiline plain_text_input), `cost` (plain_text_input), `sortOrder` (plain_text_input), `imageURL` (plain_text_input), `active` (checkboxes). The Edit view pre-populates `initial_value` from the reward, stores the reward `_id` in `private_metadata`, and appends a red "Soft-delete" button (action_id `reward_admin_softdelete`, `style: "danger"`, Slack `confirm` block with text `Hide this reward from the redemption list? Historical redemptions are not affected.`).
- [ ] 2.9 In `service/rewardAdmin.js` add `parseViewSubmission(view)` that extracts the form values from `view.state.values` and coerces `cost`/`sortOrder` to integers (returning `NaN` on non-numeric for `validateReward` to reject), and maps the `active` checkbox to a boolean.
- [ ] 2.10 Create `features/reward-admin.js`. Register `app.message(/^\s*admin\s+redeem\s*$/i, anyOf(directMention, directMessage()), handleAdminRedeem)`. In `handleAdminRedeem`: if `!rewardAdmin.isAuthorized(message.user)`, `await say("You are not authorized to manage rewards.")` and return; else `await client.views.open({ trigger_id: body.trigger_id, view: rewardAdmin.buildMainView(await rewardAdmin.listRewards()) })`. The feature receives `{ message, client, body, say }`.
- [ ] 2.11 In `features/reward-admin.js` register `app.action("reward_admin_add", ...)` → `ack()`, auth re-check, `client.views.update({ view_id: body.view.id, hash: body.view.hash, view: rewardAdmin.buildAddView() })`. Register `app.action("reward_admin_edit", ...)` → same pattern but fetch the reward by `_id` from `body.actions[0].value` and call `buildEditView`. Register `app.action("reward_admin_softdelete", ...)` → auth re-check, `softDeleteReward`, then `views.update` back to main view.
- [ ] 2.12 In `features/reward-admin.js` register `app.view("reward_admin_add_submit", ...)` and `app.view("reward_admin_edit_submit", ...)`. Each: auth re-check on `body.user.id` — if not authorized, `ack({ response_action: "errors", errors: { name: "Not authorized." } })`; else `parseViewSubmission(view)` → `validateReward` → on failure `ack({ response_action: "errors", errors })` → on success call `createReward` / `updateReward` and `ack({ response_action: "update", view: rewardAdmin.buildMainView(await rewardAdmin.listRewards()) })`. Wrap in try/catch and log errors via Winston.
- [ ] 2.13 Tighten the user-facing matcher in `features/redeem.js`: change `/redeem/i` to `/^(?!\s*admin\s+).*redeem/i` (or a negative-lookahead equivalent) so `admin redeem` does not trigger the end-user flow. Add a unit test covering both directions.
- [ ] 2.14 Create `test/service/rewardAdmin.js`. Cases: `isAuthorized` returns true for a configured admin and false otherwise (stub `config.redemptionAdmins` via `sinon.stub(config, "redemptionAdmins").value([...])`); `validateReward` returns `ok: true` on happy path and returns each specific error for empty `name`, empty `description`, negative `cost`, non-integer `cost`, non-integer `sortOrder`, and empty `imageURL`; `listRewards` calls `find({}).sort({ sortOrder: 1, name: 1 }).toArray()`; `createReward` calls `insertOne` with `active: true`, `createdBy` = actor, `updatedBy` = actor, no `kind`; `updateReward` calls `updateOne` with `$set` containing the editable fields and `updatedBy`/`updatedAt` only; `softDeleteReward` calls `updateOne` with `$set: { active: false, updatedBy, updatedAt }`.
- [ ] 2.15 In `test/service/rewardAdmin.js` add Block-Kit structure tests: `buildMainView` returns a modal view with the Add button at the top, one section per reward, an inactive-suffix on inactive rows, and an Edit button per row with the reward `_id` in `value`; `buildAddView` returns a modal with the six expected block IDs (`name`, `description`, `cost`, `sortOrder`, `imageURL`, `active`) and a `submit` field; `buildEditView(reward)` sets `initial_value` from the reward, includes `private_metadata` containing the `_id`, and includes the Soft-delete button with `confirm` text matching the spec.
- [ ] 2.16 Create `test/features/reward-admin.js`. Using `createMockApp`, register the feature and pull handlers by index. Cases: (a) non-admin `message` → `say` called with exact string `"You are not authorized to manage rewards."` and no `views.open`; (b) admin `message` → `views.open` called with the list view from `listRewards` (stub `rewardAdmin.listRewards`); (c) `reward_admin_add` action from admin → `views.update` called with the Add view; (d) `reward_admin_edit_submit` `view_submission` from a non-admin (stub `isAuthorized` to return false) → `ack` called with `response_action: "errors"`; (e) `reward_admin_add_submit` `view_submission` happy path → `createReward` called and `ack` called with `response_action: "update"` and the refreshed list view.
- [ ] 2.17 Run `npm run lint` and `npm test`. Capture passing output to `04-proofs/2.0-test-output.txt`.
- [ ] 2.18 Against the dev Slack app, DM `admin redeem` from an admin account — screenshot the modal main view (with at least one active and one inactive row) to `04-proofs/2.0-modal-main-view.png`. Click "Add new reward", fill the form, submit — screenshot the refreshed main view to `04-proofs/2.0-modal-add.png`. Click "Edit" on a row, click "Soft-delete", confirm — screenshot the confirmation dialog + refreshed main view to `04-proofs/2.0-modal-edit-softdelete.png`.
- [ ] 2.19 From a non-admin account, DM `admin redeem` and screenshot the reply showing `"You are not authorized to manage rewards."` to `04-proofs/2.0-non-admin-reject.png`.
- [ ] 2.20 Stage and commit Unit 2's files with message `feat(reward-admin): add in-Slack admin modal for reward CRUD`.

### [ ] 3.0 In-modal image upload via Slack `file_input` with public-URL conversion (Unit 3)

Replace the plain-text `imageURL` field in Add/Edit forms with Slack's `file_input`
element (single file; `jpg|jpeg|png|gif|webp`; `max_files: 1`). On submit, resolve the
uploaded file reference to a public URL via `files.sharedPublicURL` and persist it as
the reward's `imageURL`. On Edit, preserving the existing URL when no new file is
uploaded is required. On any upload failure, return `response_action: "errors"` with a
clear message and do not persist. Update `slack_app_manifest.yml` to add `files:read`
and `files:write` bot scopes; document the required reinstall in
`docs/DEVELOPMENT.md`. A short nonprod spike precedes this unit to confirm
`files.sharedPublicURL` works with a bot token; if it fails, the fallback (per spec
§Technical Considerations → Image Handling) is to revert the field to plain-text
`imageURL` and defer file upload to a follow-up spec. Commit: `feat(reward-admin): add
in-modal image upload via file_input`.

#### 3.0 Proof Artifact(s)

- Test: `npm test` passes with new `test/service/rewardAdmin.js` upload-flow cases
  covering success (file reference → public URL → persisted), Slack API failure
  (`not_allowed_token_type` → `response_action: "errors"`, no persistence),
  missing-file-on-create (validation error), edit-preserves-existing-image
  (Edit submission without a new file leaves `imageURL` untouched in the `$set`
  payload), and missing-fields-in-success-response (`ok: true` with no
  `permalink_public` throws a `GratitudeError`). Captured as
  `04-proofs/3.0-test-output.txt`.
- Spike result: `04-proofs/3.0-spike.md` documents the nonprod
  `files.sharedPublicURL` probe outcome (succeeded vs. fell back) and, if fallback,
  the exact subset of FRs in Unit 3 that ship vs. defer.
- Screenshot: add-reward form shows a Slack file picker; after upload and submit, main
  view rerenders and DM `redeem` shows the new reward's uploaded image rendered
  end-to-end — demonstrates the full upload-to-render path. Captured as
  `04-proofs/3.0-upload-end-to-end.png`.
- Screenshot: forcing a workspace-level upload failure produces the user-facing error
  in the modal with no persisted reward — demonstrates upload-failure UX. Captured as
  `04-proofs/3.0-upload-error.png`.
- Manifest diff: `git diff main...<branch> -- slack_app_manifest.yml` shows
  `files:read` and `files:write` added to `oauth_config.scopes.bot` —
  demonstrates the scope change is in source. Captured as
  `04-proofs/3.0-manifest.diff`.

#### 3.0 Tasks

- [ ] 3.1 **Spike first.** Against the dev Slack app, upload a test image into a DM with Gratibot and, from a Node REPL using the bot token, call `client.files.sharedPublicURL({ file: <file_id> })`. Record the result (success payload or exact error, including `ok: false, error: "not_allowed_token_type"`) to `docs/specs/04-spec-db-backed-reward-management/04-proofs/3.0-spike.md`. Decide: `SPIKE_OK` or `SPIKE_FALLBACK`.
- [ ] 3.2 **If `SPIKE_FALLBACK`:** stop Unit 3 implementation. Update `3.0-spike.md` with the decision and the set of Unit 3 FRs deferred. Skip all remaining 3.x tasks except 3.11 (the commit, which becomes a `docs(spec-04):` commit containing only the spike note). Continue to Unit 4.
- [ ] 3.3 Update `slack_app_manifest.yml`: add `files:read` and `files:write` under `oauth_config.scopes.bot`. Preserve existing scope ordering; add the new ones alphabetically.
- [ ] 3.4 Update `docs/DEVELOPMENT.md` with a short subsection noting that after this change local dev apps must be reinstalled to pick up the new scopes (Settings → Install App → Reinstall to Workspace).
- [ ] 3.5 In `service/rewardAdmin.js` add `resolveUploadedImageURL(fileRef, slackClient)` that: (a) calls `slackClient.files.sharedPublicURL({ file: fileRef })`, (b) extracts the `permalink_public` and the `pub_secret` token from the response — expected observed response shape (as recorded in `04-proofs/3.0-spike.md`): `{ ok: true, file: { permalink_public: "https://slack-files.com/T.../F.../name.png", url_private: "...", public_url_shared: true } }` where the `pub_secret` is the last path segment of `permalink_public` or is surfaced as a query param per the spike-captured shape. (c) builds the direct-access URL per that shape. (d) on any API error, `ok: false`, or missing required field (`permalink_public` absent, `public_url_shared: false`, or `pub_secret` not extractable), throws a `GratitudeError` with a user-facing message (`"Couldn't make the uploaded image public. Please try again or contact a maintainer."`). Include a short inline comment in the implementation flagging that the public-URL shape is not a documented stable Slack contract and pointing future readers at `04-proofs/3.0-spike.md` for the shape verified at ship time.
- [ ] 3.6 Update `buildAddView` and `buildEditView` in `service/rewardAdmin.js`: replace the `imageURL` `plain_text_input` block with a `file_input` block (`block_id: "imageFile"`, `type: "input"`, element `{ type: "file_input", max_files: 1, filetypes: ["jpg","jpeg","png","gif","webp"] }`). In the Edit view, mark `optional: true` and include helper text documenting that the existing image is kept when no new file is uploaded. In the Add view, mark `optional: false`.
- [ ] 3.7 Update `parseViewSubmission` to read `view.state.values.imageFile["imageFile_action"].files?.[0]?.id` as `fileRef` and return it in place of (or alongside) `imageURL`. When parsing an Edit submission with no new file, return `imageURL: null` to signal "preserve existing".
- [ ] 3.8 Update the `view_submission` handlers in `features/reward-admin.js` so that, after `parseViewSubmission`: if `fileRef` is present, call `rewardAdmin.resolveUploadedImageURL(fileRef, client)` (wrapped in try/catch — on `GratitudeError` ack with `response_action: "errors": { imageFile: err.userMessage }`); if `fileRef` is absent on the Add path, ack with `response_action: "errors": { imageFile: "Please upload an image." }`; if absent on the Edit path, keep the prior `imageURL` by omitting it from the `$set` payload in `updateReward`.
- [ ] 3.9 Update `validateReward` to no longer require `imageURL` when the caller indicates an Edit-with-no-new-file path (e.g., accept `imageURL: null` as "skip validation for this field").
- [ ] 3.10 Update `test/service/rewardAdmin.js` with upload-flow cases: (a) success — stub `client.files.sharedPublicURL` to resolve with a `permalink_public` + file metadata, assert the returned URL is the expected public form; (b) Slack API failure — stub to resolve `{ ok: false, error: "not_allowed_token_type" }`, assert `resolveUploadedImageURL` throws `GratitudeError` with the spec-defined user message; (c) missing-file-on-create — exercise `parseViewSubmission` with an empty `imageFile` block, then `validateReward`, assert the returned errors map contains the `imageFile` key; (d) edit-preserves-existing-image — call `parseViewSubmission` on an Edit `view` whose `imageFile` block has no files, assert the returned object carries `imageURL: null`, then assert `updateReward` (or the Edit `view_submission` handler) issues an `updateOne` whose `$set` payload does **not** include `imageURL` (so the previously-seeded URL is preserved); (e) missing-fields-in-success-response — stub `client.files.sharedPublicURL` to resolve `{ ok: true, file: {} }` (no `permalink_public`), assert `resolveUploadedImageURL` throws `GratitudeError` with the spec-defined user message.
- [ ] 3.11 Run `npm run lint` and `npm test`. Capture passing output to `04-proofs/3.0-test-output.txt`. Reinstall the dev Slack app to pick up the new scopes. Upload a reward image through the modal end-to-end, screenshot the file picker + the uploaded image rendering in a fresh `redeem` DM to `04-proofs/3.0-upload-end-to-end.png`. Force a failure (e.g., revoke scope mid-flow) and screenshot the modal error to `04-proofs/3.0-upload-error.png`. Capture `git diff main..HEAD -- slack_app_manifest.yml > 04-proofs/3.0-manifest.diff`.
- [ ] 3.12 Stage and commit Unit 3's files with message `feat(reward-admin): add in-modal image upload via file_input` (or `docs(spec-04): record file upload spike` if `SPIKE_FALLBACK`).

### [ ] 4.0 Remove `rewards.json` and reduce `service/rewardSeed.js` to the Liatrio Store entry (Unit 4)

After Unit 1's seeding is verified in nonprod, delete `rewards.json` from the repo and
remove every code path that reads it (including Unit 1's one-time startup file read).
Replace the seed module's `rewards.json` dependency with an inline seed array
containing exactly one entry: the `"Liatrio Store"` reward with `kind: "liatrio-store"`,
placeholder copy, cost `0`, and a sensible `sortOrder`. Update tests to assert the
reduced inline seed. Existing nonprod/prod databases are already populated and are
unaffected (the `countDocuments > 0` guard prevents any re-seed); fresh environments
bootstrap with just the Liatrio Store entry. Commit: `chore(redeem): remove
rewards.json after DB migration`.

#### 4.0 Proof Artifact(s)

- Test: `npm test` passes with updated `test/service/rewardSeed.js` cases asserting
  (a) the inline seed contains exactly one entry with `kind: "liatrio-store"`; (b)
  seeding inserts that entry when the collection is empty; (c) seeding does not run
  when the collection contains any documents. Captured as
  `04-proofs/4.0-test-output.txt`.
- Git diff: `git diff main...<branch> -- rewards.json service/rewardSeed.js
  service/redeem.js` shows `rewards.json` deleted, no code path reads it, and
  `service/rewardSeed.js` carries only the inline Liatrio Store entry — demonstrates
  the cleanup is complete. Captured as `04-proofs/4.0-removal.diff`.
- CLI: `grep -rn "rewards.json" . --include="*.js"` returns zero matches —
  demonstrates no residual reads. Captured as `04-proofs/4.0-grep.txt`.
- Screenshot: DM `redeem` in nonprod against the already-seeded DB renders the current
  catalog unchanged after Unit 4 merges — demonstrates JSON removal does not affect the
  live catalog. Captured as `04-proofs/4.0-nonprod-redeem.png`.
- Mongo: starting the app against a fresh empty `rewards` collection inserts exactly
  one document with `kind: "liatrio-store"` — demonstrates fresh-environment bootstrap
  behavior. Captured as `04-proofs/4.0-fresh-bootstrap.txt`.

#### 4.0 Tasks

- [ ] 4.1 **[HUMAN GATE]** Confirm Unit 1 has merged to `main` and deployed to nonprod, and that `db.rewards.countDocuments({})` in nonprod matches `rewards.json.length`, before starting Unit 4 implementation. Record the check in a quick note at the top of `04-proofs/4.0-removal.diff` (later commits append the diff itself).
- [ ] 4.2 Refactor `service/rewardSeed.js`: replace the `fs.readFileSync("../rewards.json")` + `JSON.parse` with an inline `const SEED_REWARDS = [ { name: "Liatrio Store", description: "Choose an item from the <https://liatrio.axomo.com/|Liatrio Store>. 2 Fistbumps = 1 Dollar.", imageURL: "<current-placeholder-or-existing-seeded-url>", cost: 0, sortOrder: 0, kind: "liatrio-store" } ];` Keep the `countDocuments > 0` guard unchanged so populated DBs are untouched. Keep the `active: true`, `createdBy/updatedBy: "system-seed"`, `createdAt/updatedAt` stamping.
- [ ] 4.3 Remove the `fs` and `path` imports from `service/rewardSeed.js` if no longer used.
- [ ] 4.4 Delete `rewards.json` from the repo (`git rm rewards.json`).
- [ ] 4.5 Grep the repo for any residual reference: `grep -rn "rewards.json" . --include="*.js" --include="*.md"`. Remove any leftover references. Save the (now-empty) `.js` grep output to `04-proofs/4.0-grep.txt`.
- [ ] 4.6 Update `test/service/rewardSeed.js`: remove any fixtures that depended on the 14-entry JSON. Add/update cases: (a) the inline `SEED_REWARDS` array has length 1 and its single entry has `kind: "liatrio-store"`; (b) seed-inserts-when-empty — stub `countDocuments` to resolve `0`, assert `insertMany` is called with a single-element array; (c) seed-does-not-run-when-non-empty — stub `countDocuments` to resolve `1`, assert `insertMany` is not called.
- [ ] 4.7 Run `npm run lint` and `npm test`. Capture passing output to `04-proofs/4.0-test-output.txt`.
- [ ] 4.8 Capture the per-unit diff: `git diff main..HEAD -- rewards.json service/rewardSeed.js service/redeem.js test/service/rewardSeed.js > 04-proofs/4.0-removal.diff` (note: `git diff` shows the file deletion as `/dev/null` entries).
- [ ] 4.9 Against a fresh empty DB (drop and recreate the `gratibot.rewards` collection in a local Mongo, or spin up with a fresh Docker volume), start the bot and confirm exactly one document is inserted with `kind: "liatrio-store"`. Capture the mongosh transcript to `04-proofs/4.0-fresh-bootstrap.txt`.
- [ ] 4.10 In nonprod, after Unit 4 merges and deploys, DM `redeem` and screenshot the catalog to `04-proofs/4.0-nonprod-redeem.png` — it must match the pre-Unit-4 catalog.
- [ ] 4.11 Stage and commit Unit 4's files with message `chore(redeem): remove rewards.json after DB migration`.

### [ ] 5.0 Integration verification and handoff

Confirm the full feature works end-to-end before requesting review. Run `npm run lint`
and `npm test` against the final branch state; spin up the local stack via
`docker-compose up --build` and walk all four user stories (end-user redeem parity,
admin list/add/edit/soft-delete, non-admin rejection, fresh-DB bootstrap). Consolidate
all parent-task proof artifacts under `docs/specs/04-spec-db-backed-reward-management/04-proofs/`
and verify none contain secrets or real Slack file content (only placeholder file IDs
and URLs). Open the PR with a summary that maps each functional requirement in the
spec to its proof artifact. No new code is written in this unit; it is the
handoff-readiness gate. Commit (docs-only, if anything): `docs(spec-04): capture
post-merge proofs`.

#### 5.0 Proof Artifact(s)

- CLI: `npm run lint && npm test` output shows zero lint errors and all tests
  passing on the final branch tip — demonstrates quality gates are green. Captured as
  `04-proofs/5.0-ci-local.txt`.
- CLI: `ls docs/specs/04-spec-db-backed-reward-management/04-proofs/` lists every
  artifact referenced in Units 1–4 — demonstrates proof completeness. Captured as
  `04-proofs/5.0-proofs-listing.txt`.
- CLI: `grep -rni "xoxb\|xapp\|secret\|token" docs/specs/04-spec-db-backed-reward-management/04-proofs/`
  returns zero matches — demonstrates no secrets leaked into artifacts. Captured as
  `04-proofs/5.0-secret-scan.txt`.
- URL: PR URL with description cross-linking each spec FR to its proof artifact —
  demonstrates reviewer-ready state. Captured as `04-proofs/5.0-pr.txt`.
- Screenshot: PR CI status (checks) all green — demonstrates the branch merges
  cleanly with CI. Captured as `04-proofs/5.0-pr-checks.png`.

#### 5.0 Tasks

- [ ] 5.1 From the final branch tip, run `npm run lint && npm test 2>&1 | tee 04-proofs/5.0-ci-local.txt`. Any failure → fix and re-run until green.
- [ ] 5.2 `ls -la docs/specs/04-spec-db-backed-reward-management/04-proofs/ > 04-proofs/5.0-proofs-listing.txt`. Manually cross-check the list against every Proof Artifact bullet in this tasks file; add any missing artifact before proceeding.
- [ ] 5.3 Run `grep -rni "xoxb\|xapp\|secret\|password\|bearer" docs/specs/04-spec-db-backed-reward-management/04-proofs/ > 04-proofs/5.0-secret-scan.txt || true`. Inspect the output — any hit that is not a placeholder must be redacted before PR.
- [ ] 5.4 Push the branch: `git push -u origin feat/04-db-backed-rewards`. Open a PR to `main` with a description body that cross-links every spec FR (quote the FR text + link to the proof artifact path). Save the PR URL to `04-proofs/5.0-pr.txt`.
- [ ] 5.5 Wait for CI checks on the PR. Screenshot the all-green checks panel to `04-proofs/5.0-pr-checks.png`.
- [ ] 5.6 If any artifact was added/updated during Unit 5, commit with `docs(spec-04): capture post-merge proofs` and push. Otherwise Unit 5 is diffless and no commit is required.
- [ ] 5.7 Hand off for review. Note in the PR description any Unit 3 fallback decision and what a follow-up spec would cover.
