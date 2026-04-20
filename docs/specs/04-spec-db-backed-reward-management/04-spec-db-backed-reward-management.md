# 04-spec-db-backed-reward-management.md

## Introduction/Overview

Today the Gratibot reward catalog lives in `rewards.json` and is baked into
the container image. Adding, editing, or removing a reward requires a code
change, PR review, merge, and redeploy — friction that discourages the
redemption admins from keeping the catalog current. This spec moves the
catalog into MongoDB and exposes an in-Slack admin UI (a single modal)
so redemption admins can view, add, edit, and retire rewards —
including uploading a new reward image via Slack's built-in file input —
without engineering involvement and without a deploy. The existing end-user
`redeem` flow continues to work exactly as it does today.

The admin surface is reached through a general-purpose `admin` command
(DM or `@gratibot admin`), which replies with the set of admin-control
buttons the invoking user is permitted to see. In v1 the only button is
"Manage Rewards" (redemption admins). Future admin capabilities add
their own buttons gated by their own role checks, reusing the same
dispatcher.

## Goals

- Persist rewards in a new MongoDB `rewards` collection that is the single
  source of truth at runtime, replacing `rewards.json` as the read source.
- Let redemption admins view, add, edit, and retire (via the `active`
  checkbox) rewards through a single Slack modal opened by DMing or
  `@gratibot admin` and clicking the "Manage Rewards" button.
- Let admins attach a reward image via Slack's `file_input` block element so
  the image is uploaded inside the modal rather than hosted externally.
- Keep the end-user redemption flow byte-identical in layout and behavior:
  same header, same list sorting, same select-menu interaction, same
  post-redemption MPIM to the redemption admins.
- Require no app redeploy to change the catalog — admins' changes take
  effect immediately after modal submission.

## User Stories

- **As a redemption admin**, I want to DM `admin` to Gratibot, click
  "Manage Rewards", and see a modal listing every reward so that I can
  review the current catalog without opening a shell or a PR.
- **As a redemption admin**, I want to add a new reward (name,
  description, cost, sort order, image, active state) through a form in
  the same modal so that I can refresh the catalog in minutes.
- **As a redemption admin**, I want to edit an existing reward's fields
  and optionally replace its image so that I can fix typos, adjust
  costs, and swap artwork without an engineering handoff.
- **As a redemption admin**, I want to hide a retired reward from the
  end-user redeem list by unchecking its "Active" checkbox so that I
  can retire items without losing their record or affecting
  historical redemptions.
- **As an end user**, I want DMing `redeem` to continue to show me the
  same rewards UI I am used to so that I do not notice this change
  except that the catalog is fresher.
- **As a non-admin end user**, I want to be told clearly that I have no
  admin access when I try `admin` so that the system's boundary is
  obvious rather than silent.
- **As a Gratibot maintainer**, I want the `rewards` collection to seed
  itself from `rewards.json` on first empty startup so that the catalog
  migration to the database does not require a manual data import step.

## Demoable Units of Work

### Unit 1: `rewards` collection + startup seeding + DB-backed redeem

**Purpose:** Move the source of truth for the reward catalog from
`rewards.json` into MongoDB without changing the end-user UX. After this
unit, the running bot reads rewards from the database; `rewards.json`
still exists in the repo for seeding but is no longer read during
request handling.

**Functional Requirements:**

- The system shall create a new `rewards` MongoDB collection with the
  schema defined in the **Data Model** section.
- The system shall, on application startup (from `app.js`), check
  whether `rewards` is empty and, if so, insert one document per entry
  in the existing `rewards.json` with `sortOrder` reflecting the entry's
  current array position (zero-indexed), `active: true`,
  `createdBy: "system-seed"`, `createdAt: now`, `updatedBy: "system-seed"`,
  and `updatedAt: now`. Existing `imageURL` values from `rewards.json`
  shall be carried over verbatim.
- The system shall not seed if the `rewards` collection already contains
  at least one document, so restarts do not double-seed.
- The service function that builds the redemption blocks (currently
  `service/redeem.js` `createRedeemBlocks`) shall read rewards from the
  database, filter to `active: true`, and sort ascending by `sortOrder`
  with a name tiebreak, producing identical Block Kit output to today's
  `rewards.json`-backed version for equivalent data.
- The system shall seed the existing `"Liatrio Store"` entry with
  `kind: "liatrio-store"` in addition to its other fields, so the
  special redemption branch is identified by a stable identifier
  rather than a display string.
- The system shall update `features/redeem.js` to branch on
  `kind === "liatrio-store"` (replacing today's `itemName === "Liatrio
  Store"` string check) when rendering the Axomo-link redemption
  message. The selected-item payload shall carry `kind` alongside
  `name` and `cost` so the feature handler has it available at
  decision time.
- The system shall not expose `kind` in the admin modal UI in v1.
  Rewards added via the admin modal are created without `kind` set
  (or with `kind: null`); `kind` is a system-internal field and is
  preserved unchanged on Edit.
- The system shall preserve the current behavior of the end-user
  `redeem` command, including the MPIM creation with the redemption
  admins and the deduction record. No change to `deductions` schema.

**Proof Artifacts:**

- `Test: test/service/redeem.js specs pass, including new cases that stub
  rewardCollection.find and assert createRedeemBlocks filters inactive
  rewards and sorts by sortOrder then name` demonstrates DB-backed
  block generation is correct.
- `Test: test/service/rewardAdmin.js (or test/service/rewardSeed.js) specs
  cover seed-runs-when-empty and seed-does-not-double-run cases`
  demonstrates seeding logic is idempotent.
- `Screenshot: DM to dev Gratibot with "redeem" renders the same header,
  item list, and static select menu as before the change` demonstrates
  end-user parity.
- `Mongo: db.rewards.find().count() equals the number of entries in
  rewards.json after first nonprod startup; rerunning startup does not
  increase the count` demonstrates seed correctness and idempotency.

### Unit 2: Admin modal — authorization, list view, add, edit (no image upload yet)

**Purpose:** Add the in-Slack admin surface that lets redemption admins
perform CRUD on reward records, with the image field accepted as a
plain text URL for this unit. Image upload via file input is added in
Unit 3. End-user redeem flow is unchanged.

**Post-Unit-2 update (2026-04):** the Edit form's "Soft-delete" button
was removed. Retiring a reward is now done by unchecking the "Active"
checkbox and saving — the same end state (`active: false`) via a
field already in the form. This removes the confirmation dialog, the
`reward_admin_softdelete` action, and the `softDeleteReward` service
function; the individual task bullets below are preserved as a record
of what was committed under Unit 2. See also the post-Unit-2
`admin redeem` → `admin` rename noted in the tasks file.

**Functional Requirements:**

- The system shall register a new Bolt message matcher that fires on the
  exact text `admin` (case-insensitive, trimmed), in either a DM to the
  bot or a `@gratibot admin` directed message in a channel.
- The `admin` handler shall build the set of admin-control buttons the
  invoking user is permitted to see by checking each admin role in turn.
  In v1 the only button is "Manage Rewards" (`action_id:
  reward_admin_open`, `style: primary`), gated on
  `config.redemptionAdmins` membership. Future admin capabilities add
  themselves to this list, each with their own authorization check.
- The system shall, when `admin` is invoked by a user with no admin
  roles (empty button list), respond with the exact text
  `You do not have admin access.` and do nothing else.
- The system shall, when `admin` is invoked by a user with at least one
  admin role, respond with a message whose body is an `actions` block
  containing the permitted buttons. The response is posted via `say`
  because `message` events do not carry a `trigger_id`, so a modal
  cannot be opened directly from the message.
- The system shall, when the "Manage Rewards" button is clicked, re-check
  that the clicker is in `config.redemptionAdmins` (actions carry
  `body.user.id` independently of the original message author — the
  re-check defends against another user clicking a stale button in a
  shared channel). On re-check failure, respond ephemerally with
  `You are not authorized to manage rewards.` and do not open the
  modal. On success, call `client.views.open` with the trigger_id from
  the action and a view whose main content lists every reward in the
  `rewards` collection (both active and inactive), sorted the same way
  as the end-user list (ascending `sortOrder`, name tiebreak). Each row
  shall show name, cost, `sortOrder`, a visible active/inactive
  indicator, a thumbnail image (rendered from the reward's `imageURL`
  via a Slack `image` accessory), and an "Edit" button. An "Add new
  reward" button shall sit at the top of the modal.
- The system shall, when "Add new reward" is clicked, replace the modal
  contents with an Add form containing inputs for `name`, `description`
  (multiline), `cost`, `sortOrder`, `imageURL` (plain text input in this
  unit), `active` (checkbox, default checked), and Submit + Cancel
  buttons. Submit shall persist a new document with `createdBy` and
  `updatedBy` set to the invoking admin's Slack user ID and
  `createdAt` + `updatedAt` set to now, then return the admin to the
  updated main view.
- The system shall, when "Edit" is clicked on a row, replace the modal
  contents with a form pre-populated with that reward's current values,
  containing the same fields as Add. Submit shall persist updates to
  that document's editable fields (including the `active` checkbox,
  which is how an admin retires a reward) and set `updatedBy` and
  `updatedAt`, then return the admin to the updated main view.
- The system shall validate on Submit: `name` is non-empty, `description`
  is non-empty, `cost` is an integer `>= 0`, `sortOrder` is an integer
  (negatives allowed), and `imageURL` is a non-empty string. On
  validation failure, the system shall return a Slack
  `response_action: "errors"` payload with field-level error messages
  and not persist.
- The system shall leave the end-user redeem flow unchanged; end users
  continue to see only active rewards via Unit 1's DB-backed read path.

**Proof Artifacts:**

- `Test: test/service/rewardAdmin.js specs cover listRewards,
  createReward, updateReward, and isAuthorized` demonstrates CRUD
  and authorization logic is covered. Retiring a reward is exercised
  via updateReward with active: false.
- `Test: test/features/reward-admin.js specs cover non-admin rejection
  message and admin modal-open path (with Slack client stubbed)`
  demonstrates the feature-layer gate is enforced.
- `Screenshot: modal main view showing active and inactive rewards
  distinguished` demonstrates the list view renders correctly.
- `Screenshot: modal add-reward form, filled and submitted; modal
  returns to main view with the new entry listed` demonstrates the add
  path.
- `Screenshot: modal edit-reward form with the Active checkbox
  unchecked; after Save, main view shows the row as inactive`
  demonstrates the edit and retire paths.
- `Slack: DM "admin" from a non-admin account replies with
  "You do not have admin access." and no button is shown, so no modal
  can be opened` demonstrates the authorization boundary.

### Unit 3: Image upload via Slack `file_input` with public-URL conversion

**Purpose:** Replace the plain-text `imageURL` input in the admin form
with Slack's `file_input` block element so admins can drop an image
into the modal directly, and convert the uploaded file into a URL the
existing image-rendering code can use.

**Functional Requirements:**

- The system shall replace the `imageURL` plain-text input in the Add
  and Edit forms with a Slack `file_input` element configured for a
  single image file (accepted filetypes `jpg`, `jpeg`, `png`, `gif`,
  `webp`; `max_files: 1`). `imageURL` is required on Add; on Edit, if
  the admin does not upload a new file, the existing `imageURL` on the
  document shall be preserved.
- The system shall, on modal submission with a newly uploaded file,
  read the uploaded file reference from `view.state.values`, obtain a
  publicly accessible URL for the file via Slack's public-URL flow
  (see **Technical Considerations → Image Handling** for current
  constraints and fallbacks), and store the resulting URL in the
  reward document's `imageURL` field.
- The system shall, on failure to obtain a public URL (Slack API error,
  bot-token scope mismatch, workspace-level restriction, or validation
  failure on the uploaded file), return a `response_action: "errors"`
  payload with a clear user-facing message explaining the upload
  problem and shall not persist the reward changes.
- The system shall require the bot token to have the `files:read` and
  `files:write` scopes; the app manifest shall be updated accordingly.
- The system shall preserve existing reward images: rewards seeded from
  `rewards.json` keep their Azure-Blob-hosted `imageURL` values until
  an admin explicitly replaces them via a new upload.

**Proof Artifacts:**

- `Test: test/service/rewardAdmin.js upload-flow specs cover success,
  Slack API failure, and missing-file-on-create cases` demonstrates
  upload error paths are handled.
- `Screenshot: add-reward form shows a file picker; image uploads;
  modal returns to main view with the new reward row rendering the
  uploaded image in end-user redeem view` demonstrates the end-to-end
  upload path.
- `Slack app manifest diff: bot scopes gain files:read and files:write`
  demonstrates the required scope change is captured in source.

### Unit 4: Remove `rewards.json` from the repo

**Purpose:** After Unit 1's seeding is verified in nonprod, retire the
legacy JSON file so the repository no longer carries a stale copy of
the catalog.

**Functional Requirements:**

- The system shall verify in nonprod that the `rewards` collection is
  seeded and the end-user redeem flow matches prior behavior before
  this unit's changes merge.
- The system shall delete `rewards.json` from the repo and remove
  any remaining code path that reads it, including the one-time
  startup read from Unit 1's seeding logic.
- The system shall retain `service/rewardSeed.js` with an inline
  seed array containing only the `"Liatrio Store"` entry
  (`kind: "liatrio-store"`, with placeholder copy, cost `0`, and a
  sensible `sortOrder`). A fresh environment with an empty `rewards`
  collection bootstraps with just that one entry; all other rewards
  are added by redemption admins via the modal after startup. This
  is an intentional trade-off: the live catalog in nonprod/prod is
  already populated from Unit 1's seeding and is unaffected by this
  change, while disaster-recovery and fresh-nonprod bootstraps
  produce a minimal working catalog rather than a stale snapshot.
- The system shall cover the reduced seeding logic with tests:
  (a) the inline seed contains exactly one entry with
  `kind: "liatrio-store"`; (b) seeding inserts that entry when the
  collection is empty; (c) seeding does not run when the collection
  already contains any documents.

**Proof Artifacts:**

- `Screenshot: DM "redeem" in nonprod against the already-seeded DB
  renders the current catalog unchanged after Unit 4 merges`
  demonstrates that the JSON removal does not affect the live catalog.
- `Git diff: rewards.json removed; no code path reads rewards.json;
  service/rewardSeed.js inline seed contains only the "Liatrio Store"
  entry with kind: "liatrio-store"` demonstrates the cleanup is
  complete and the reduced seed is in place.
- `Test: seed specs pass against the reduced inline seed, asserting
  exactly one entry with kind: "liatrio-store"` demonstrates the
  post-deletion seed is correct.
- `Mongo: starting the app against an empty rewards collection seeds
  exactly one document (the Liatrio Store entry)` demonstrates the
  fresh-environment bootstrap behavior.

## Non-Goals (Out of Scope)

1. **Hard-delete of rewards** — all deletions are soft-deletes. The
   admin modal does not expose a destructive delete button.
2. **Categorization or filtering** — rewards do not carry a category
   field, and the admin modal does not support filtering by tag or
   type.
3. **Bulk import/export UI** — no CSV import, no JSON export, no API
   endpoint to mutate the catalog from outside Slack.
4. **Drag-and-drop reordering** — admins set `sortOrder` as a number;
   tie-breaking is by name.
5. **Mutating historical deductions** — `deductions` remain immutable
   snapshots. `rewardName` stored on a deduction is not retroactively
   renamed when the rewards catalog is edited.
6. **Replacing Azure-Blob-hosted images for existing rewards** — the
   seed carries current `imageURL` values forward unchanged. Admins
   replace images by editing a reward and uploading a new file.
7. **Pagination of the admin modal main view** — the current catalog
   (~14 entries) fits comfortably under Slack's 100-block limit.
   Pagination is deferred until that limit becomes a real constraint.
8. **Concurrent-edit conflict handling** — last-write-wins on Submit;
   no optimistic-concurrency version field.
9. **Unique name enforcement** — `name` is a display field, not a key.
   Admins are trusted not to create duplicate names. The Liatrio
   Store integration is no longer coupled to the display name (it
   uses `kind`), so duplicate names are a cosmetic concern only.

## Design Considerations

- The `admin` message handler is an extensible dispatcher: it composes
  the reply blocks from a list of buttons, each gated by its own
  authorization predicate. Adding a new admin capability in the future
  means registering a new button (and its action/view handlers) in the
  same feature module — no changes to the matcher or dispatcher needed.
- The admin modal is a single `views.open` modal whose contents are
  swapped via `views.update` as the admin navigates between main view,
  Add form, and Edit form. The view stack is not used.
- The main view visually distinguishes inactive rewards (e.g., italic
  "(inactive)" suffix, or a dimmer row style via Block Kit context
  blocks). Exact styling is left to implementation but must make the
  state unambiguous at a glance.
- The main view renders each reward's `imageURL` as a Slack `image`
  accessory next to the row text so admins see the same artwork end
  users see. Because Slack sections allow only one accessory, the
  per-row "Edit" button lives in an `actions` block immediately below
  the reward's section.
- The Edit form retires a reward via its "Active" checkbox: unchecking
  and Saving sets `active: false` on the document, which hides the
  row from the end-user redeem list. There is no separate soft-delete
  button or confirmation dialog. Historical redemptions are unaffected
  because `deductions` records carry their own snapshot.
- The end-user `redeem` Block Kit output is unchanged in structure,
  ordering, and copy. Same header, same help text, same item sections,
  same static-select at the bottom.
- All admin-only strings (authorization error, modal labels, button
  copy, validation errors) should be consistent with the existing
  tone of the deduction/refund features, which already address
  redemption admins directly.

## Repository Standards

Follow the patterns already established in this repository:

- **Layer separation**: database → service → features. The new
  `database/rewardCollection.js` defines the collection and indexes;
  new service modules (`service/rewardAdmin.js` for CRUD + validation,
  `service/rewardSeed.js` for startup seeding) contain all business
  logic; a new feature module (`features/reward-admin.js`) owns the
  Bolt matchers, modal open/update, and `view_submission` handlers.
  Services must not take Slack event shapes as parameters; features
  must not talk to MongoDB directly. Matches existing feature/service
  boundaries described in `docs/ARCHITECTURE.md`.
- **File naming**: kebab-case for files (e.g., `reward-admin.js`),
  camelCase for exported functions.
- **Async style**: `async`/`await` throughout; errors propagate from
  services and are translated into user-facing Slack responses in
  feature handlers.
- **Logging**: use `./winston` with structured context
  (`{ func, callingUser, rewardId, ... }`) on every log statement, as
  per `docs/ARCHITECTURE.md` → Logging.
- **Testing**: Mocha + Chai + Sinon; stubs restored via
  `sinon.restore()` in `afterEach`; tests mirror source structure under
  `test/`. Cover happy path, validation failures, and authorization
  rejection at minimum. Matches `docs/TESTING.md`.
- **Config discipline**: any new tunable values live in `config.js`
  and read from environment variables with sensible defaults, as with
  existing `redemptionAdmins` and `mongo_url`.
- **Commit discipline**: Conventional Commits per `CLAUDE.md`; the
  parent-level change for this spec is a `feat:` because it introduces
  a user-facing admin surface. Individual commits scoped per demoable
  unit.
- **Pre-commit**: `npm run lint` passes; `npm test` passes with the
  new specs included.

## Technical Considerations

### Data Model

New MongoDB collection `rewards`:

```javascript
{
  _id: ObjectId,
  name: String,          // required, display name
  description: String,   // required; supports Slack mrkdwn link syntax
  cost: Number,          // required, integer >= 0
  imageURL: String,      // required; publicly accessible URL
  sortOrder: Number,     // required; lower sorts first
  active: Boolean,       // true = shown in end-user redeem list
  kind: String,          // optional system identifier for integration-linked
                         //   rewards. v1 values: "liatrio-store" for the
                         //   Axomo-redirect branch. Absent/null for standard
                         //   admin-created rewards. Not shown in admin UI.
  createdBy: String,     // Slack user ID or "system-seed"
  createdAt: Date,
  updatedBy: String,     // Slack user ID or "system-seed"
  updatedAt: Date
}
```

Indexes to create in `database/rewardCollection.js`:

- `{ active: 1, sortOrder: 1 }` — supports the redeem read path.
- `{ sortOrder: 1, name: 1 }` — supports the admin list path.

`deductions` schema is unchanged. `rewardName` remains a string
snapshot captured at redemption time.

### Modal Flow

- `app.message` handler for `admin` → compose the per-user button
  list → `say` a message with those buttons. `message` events do not
  carry a `trigger_id`, so the modal cannot be opened directly from
  the message itself; the subsequent button click supplies the
  trigger_id.
- `app.action("reward_admin_open", ...)` → re-check redemption-admin
  membership on the clicker → `client.views.open` with the main view
  built by the rewardAdmin service.
- "Add new reward" and "Edit" buttons are `block_actions`; handlers
  call `client.views.update` to swap the modal contents.
- Submit is `view_submission`; handler validates inputs, persists via
  rewardAdmin service, and responds with `response_action: "update"`
  pointing at the rebuilt main view on success, or
  `response_action: "errors"` with field-level errors on validation
  failure.

### Image Handling

Slack's `file_input` block element (see [Slack file_input element
docs](https://docs.slack.dev/reference/block-kit/block-elements/file-input-element/))
is supported inside modal `input` blocks and delivers file references
via `view.state.values` on submission. Required scope: `files:read`.

Turning that uploaded file into a URL that the existing image block in
`createRedeemBlocks` can render publicly is the risk area flagged by
the user. Per [Slack's `files.sharedPublicURL`
docs](https://docs.slack.dev/reference/methods/files.sharedPublicURL/)
and [slackapi/node-slack-sdk#1000](https://github.com/slackapi/node-slack-sdk/issues/1000),
that method has historically required a user token rather than a bot
token, returning `not_allowed_token_type` for bot tokens.

**Resolution approach for this spec**:

- Unit 3 begins with a short nonprod spike that invokes
  `files.sharedPublicURL` with the bot token against a real uploaded
  file. If it succeeds, Unit 3 ships the in-modal upload flow as
  designed.
- If the spike fails (bot token still rejected, or workspace policy
  blocks public URLs), drop the in-modal upload from v1: the admin
  form's image field reverts to a plain-text `imageURL` input and
  the `files:write` scope is removed from the manifest change. The
  file-upload goal is deferred to a follow-up spec.
- We are explicitly not pursuing the post-to-a-workspace-channel
  permalink workaround in this spec. The channel-dependency trade-off
  is not worth the operational cost for v1.

### Matcher Disambiguation

The admin command is `admin`, not `admin redeem`, so it does not
collide with the existing `/redeem/i` matcher in
`features/redeem.js` — the strings "admin" and "redeem" share no
overlap. No disambiguation is required; `features/redeem.js` keeps
its original matcher.

### Seeding

A dedicated `service/rewardSeed.js` module exports a function called
by `app.js` during startup (after `client.connect()` resolves,
before Bolt listeners are bound). It performs
`rewardCollection.countDocuments({})` and, if zero, inserts the
initial catalog via `insertMany`. Seeding logs at `info` level with
the number of documents inserted; zero-insert (already seeded) logs
at `debug`.

The contents of that initial catalog differ between Unit 1 and Unit
4:

- **Unit 1** (migration): the seed reads `rewards.json` at startup,
  so first-start-against-empty-DB produces the full ~14-entry
  catalog. This is the one-time migration path for nonprod and
  prod.
- **Unit 4** (post-migration cleanup): `rewards.json` is deleted
  and the seed module's inline data is reduced to only the
  `"Liatrio Store"` entry with `kind: "liatrio-store"`. Existing
  nonprod and prod environments are already populated and are
  unaffected (the `countDocuments > 0` guard prevents any re-seed).
  Fresh environments bootstrap with just the Liatrio Store entry;
  admins add other rewards via the modal.

### Scopes

The Slack app manifest (`slack_app_manifest.yml`) shall be updated
to add `files:read` and `files:write` to the bot scopes. A note in
`docs/DEVELOPMENT.md` shall mention that local dev apps must be
reinstalled after this change to acquire the new scopes.

## Security Considerations

- **Authorization**: only `config.redemptionAdmins` users may open
  the admin modal or submit any admin modal view. The "Manage
  Rewards" button is only shown to redemption admins at the `admin`
  dispatcher step, and the `reward_admin_open` action handler
  re-checks membership (so another user who sees the button in a
  shared channel cannot click through to the modal). The feature
  handler must also re-check membership on every `view_submission`
  and every `block_actions` inside the modal — so a non-admin cannot
  race the modal open or replay a view_submission payload.
- **Image public-URL tradeoff**: any image URL stored in `imageURL`
  is by definition public to anyone with the URL. Admins must be
  aware that uploaded reward images become publicly accessible on
  the internet. Document this in the admin modal's upload field
  helper text.
- **Input validation**: all admin-supplied strings are stored as-is
  and later rendered in Slack Block Kit. Slack renders `mrkdwn` in
  `section` text; admins can inject `<url|label>` links, which is
  intended. Do not allow HTML or script content in any field — Block
  Kit sanitizes this by default but tests must assert the happy path
  produces the expected output.
- **MongoDB injection**: use parameterized MongoDB driver calls
  (findOne, updateOne, etc.) with Slack-supplied values as values,
  never as field names. No dynamic field names from user input.
- **Logging**: do not log image binary content or full raw Slack file
  objects. Log Slack file IDs, user IDs, reward IDs, and outcome, not
  payload bodies.
- **Secrets**: no new tokens, secrets, or credentials are introduced
  by this spec. The existing bot token gains two Slack scopes; that
  scope change flows through the existing
  `BOT_USER_OAUTH_ACCESS_TOKEN` env var and is visible in the Slack
  app manifest in the repo.

## Success Metrics

1. **Zero deploys required for catalog changes**: after this spec
   ships, every future reward addition, edit, or retirement is done
   via `admin` → "Manage Rewards" with no GitHub PR and no container
   deploy.
2. **End-user parity**: the Block Kit JSON produced by
   `createRedeemBlocks` for the seeded catalog is byte-identical
   (modulo new `imageURL` values for admin-replaced images) to the
   pre-change output for the same reward data.
3. **Admin flow reliability**: in a one-week nonprod bake period,
   a redemption admin completes at least one add, one edit, and one
   retire (uncheck Active + Save) via the modal without an error
   requiring an engineer.
4. **Test coverage**: all new service modules have happy-path,
   validation-failure, and authorization tests; `npm test` passes.
5. **`rewards.json` removal lands**: the file is deleted from the
   repo after nonprod verification, closing the migration.

## Open Questions

No open questions at this time.
