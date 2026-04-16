# 03-tasks-ci-cd-hardening.md

## Relevant Files

| File | Why It Is Relevant |
|---|---|
| `.github/workflows/release.yml` | Unit 1: remove dead `if:` gate, `workflow_dispatch`, `TF_VAR_gratibot_limit`, and inlined tenant ID. Unit 2: migrate tool install to `gruntwork-io/terragrunt-action`. Unit 5: replace `GRATIBOT_RELEASE_TOKEN` with `actions/create-github-app-token`. |
| `.github/workflows/apply-prod.yml` | Unit 1: remove dead `if:` gate, `workflow_dispatch`, typo'd `GRATIBOT_LIMIT`, inlined tenant ID, add `plan` environment clarifying comment. Unit 2: migrate tool install. Unit 4: replace `build` job with `promote` (image retag, no rebuild). |
| `.github/workflows/pull-request.yaml` | Unit 1: fix `needs.build.outputs.docker_tag` → `needs.setup.outputs.docker-tag`, drop `needs: build` from `validate`, replace inlined tenant ID, add top-level `concurrency` block. Unit 2: migrate tool install. |
| `.github/workflows/ci.yaml` | Unit 3: new consolidated workflow containing `lint`, `test`, `codeql` jobs with schedule-aware guards, shared concurrency, and Node caching. |
| `.github/workflows/test.yaml` | Unit 3: deleted after `ci.yaml` lands. |
| `.github/workflows/lint.yaml` | Unit 3: deleted after `ci.yaml` lands. |
| `.github/workflows/codeql-analysis.yml` | Unit 3: deleted after `ci.yaml` lands (stale `pathsIgnore` matrix dimension also dropped). |
| `.github/workflows/publish-techdocs-to-s3.yaml` | Unit 6: deleted (unused Backstage TechDocs publishing workflow). |
| `mise.toml` | Unit 2: new root-level single source of truth pinning `opentofu` and `terragrunt` versions (Terragrunt ≥ `0.77.22`, OpenTofu compatible with existing `~1.9`). |
| `infra/terragrunt/nonprod/gratibot/terragrunt.hcl` | Unit 2: relabel unlabeled `include {}` block as `include "root" { ... }` to silence the Terragrunt 0.77 deprecation warning. |
| `infra/terragrunt/prod/gratibot/terragrunt.hcl` | Unit 2: same relabel as the nonprod file. |
| `catalog-info.yaml` | Unit 6: deleted (Backstage catalog descriptor, no longer used). |
| `mkdocs.yml` | Unit 6: deleted (MkDocs site config for the removed TechDocs workflow). |
| `docs/index.md` | Unit 6: deleted (TechDocs landing page; no remaining cross-links point at it). |
| `docs/specs/03-spec-ci-cd-hardening/03-proofs/` | Destination for all proof artifacts (diff copies, CI run URLs, screenshots, grep outputs, image-inspect outputs). Must contain no secrets, tokens, or private keys. |

### Notes

- **No service/feature-layer tests are added.** `docs/TESTING.md` applies unit-test coverage
  to business logic in `service/`, which this spec does not modify. Workflow correctness is
  verified via CI-run proof artifacts (the workflows themselves are the executable tests).
- **Single-branch, one-commit-per-unit, one-PR workflow.** All six unit commits land on a
  single feature branch (`ci/03-cicd-hardening`), created once in Unit 1. Each parent task
  (Units 1–6) ends in exactly one commit whose message starts with the appropriate
  conventional-commit prefix for that unit's change. Nothing is pushed or opened as a PR
  until **Unit 7** runs; Unit 7 handles push, PR creation, PR CI evidence capture,
  pre-merge branch-protection rename, merge, and post-merge release/apply-prod evidence.
- **Commit order mirrors parent-task order** (Unit 1 first, Unit 6 last) and follows the
  spec's Key Ordering and Dependencies (§7): Unit 1 before Units 2 and 4, Unit 2 before
  or with Unit 3, Unit 4 with or after Unit 1, Units 5 and 6 independent. Do not squash
  at merge time — preserve per-unit commits for bisectability. Use "Merge commit" or
  "Rebase and merge"; avoid "Squash and merge".
- **Pre-flight human gates must complete before any commits are pushed**, because the PR's
  CI run (Unit 7) will exercise the new references:
  - `AZURE_TENANT_ID` repo variable must exist (Task 1.1 → Out-of-Repo Prereq #2).
  - GitHub App created/installed and `RELEASE_APP_ID` + `RELEASE_APP_PRIVATE_KEY`
    available (Tasks 5.1 and 5.2 → Out-of-Repo Prereq #1).
  Put another way: Tasks 1.1, 5.1, and 5.2 are the only `[HUMAN GATE]` items that must
  happen before Unit 7 pushes the branch.
- **Branch naming:** use `ci/03-cicd-hardening` (matches the spec's conventional-commit
  prefix for the PR as a whole). Direct pushes to `main` are rejected (per `AGENTS.md`).
- **Action SHA pins:** new action references (`gruntwork-io/terragrunt-action`,
  `actions/create-github-app-token`) must be pinned to a commit SHA with a `# vX.Y.Z`
  comment, matching the existing convention used for `actions/checkout`,
  `actions/setup-node`, and `mikefarah/yq`.
- **Pre-commit:** run `npm run lint` before each unit's commit (the husky hook will also
  run it). No `npm test` is required for workflow-only commits, but running it costs
  nothing and matches the repo's review checklist.

## Tasks

### [x] 1.0 Deploy-workflow correctness fixes

Fix latent bugs in `release.yml`, `apply-prod.yml`, and `pull-request.yaml` so that
subsequent structural changes (Units 2 and 4) land on a correct baseline. Removes the
dead actor allow-list `if:` gate, the typo'd `GRATIBOT_LIMIT` env entry and unused
`workflow_dispatch` inputs, the broken `needs.build.outputs.docker_tag` reference in
the PR workflow, and the inlined Azure tenant ID. Adds a top-level `concurrency` block
to `pull-request.yaml` and a clarifying comment above the `plan` environment in
`apply-prod.yml`. Lands first per the spec's Key Ordering and Dependencies (§7).

#### 1.0 Proof Artifact(s)

- Diff: `git diff main..ci/03-cicd-hardening -- .github/workflows/release.yml .github/workflows/apply-prod.yml .github/workflows/pull-request.yaml` at the Unit 1 commit boundary shows the dead `if:` gate removed, `workflow_dispatch` + `gratibot_limit` block gone, hardcoded tenant ID replaced with `${{ vars.AZURE_TENANT_ID }}`, the PR workflow's top-level `concurrency` block added, and the `needs.setup.outputs.docker-tag` reference correct — demonstrates each FR-1 requirement is encoded. Captured as `03-proofs/1.0-diff.patch` by Task 7.11.
- CI run (PR-level): PR-triggered run of `pull-request.yaml` under Unit 7's PR shows `validate` and `plan` jobs interpolating the `setup.outputs.docker-tag` value into `TF_VAR_gratibot_image` and completing successfully — demonstrates the `needs` fix works end-to-end. Captured as `03-proofs/1.0-pr-run.txt` by Task 7.2.
- CI run (post-merge): Post-merge `release.yml` run shows the nonprod `apply` job succeeded without referencing `inputs.gratibot_limit` — demonstrates trigger simplification did not break the push path. Captured as `03-proofs/1.0-release-run.txt` by Task 7.6.
- Human gate evidence: Screenshot of the repo's Settings → Secrets and variables → Actions → Variables tab showing the `AZURE_TENANT_ID` repository variable present. Captured as `03-proofs/1.0-azure-tenant-id-variable.png` by Task 1.1 (pre-flight). Confirms Out-of-Repo Prerequisite #2 was completed before the PR was opened.

#### 1.0 Tasks

- [~] 1.1 [HUMAN GATE] Add `AZURE_TENANT_ID` as a repository variable under Settings → Secrets and variables → Actions → Variables with the value `1b4a4fed-fed8-4823-a8a0-3d5cea83d122`. Capture a screenshot to `docs/specs/03-spec-ci-cd-hardening/03-proofs/1.0-azure-tenant-id-variable.png` (Out-of-Repo Prereq #2). Implementation agent must not attempt to set this. **Must complete before Unit 7 pushes the branch.**
- [x] 1.2 Create branch `ci/03-cicd-hardening` from `main`. All six unit commits land on this single branch; do not create new branches for subsequent units.
- [x] 1.3 In `.github/workflows/release.yml`, remove the `workflow_dispatch:` trigger block (the trigger key and the `gratibot_limit` input definition). The `on:` block should retain only `push: branches: [main]` with `paths-ignore`.
- [x] 1.4 In `.github/workflows/release.yml`, remove the `if: github.event_name == 'push' || contains(fromJSON('["Pactionly", "gesparza3"]'), github.actor)` line from the `build` job.
- [x] 1.5 In `.github/workflows/release.yml`'s nonprod `apply` job, remove the `TF_VAR_gratibot_limit: ${{ inputs.gratibot_limit }}` line from the step's `env:` block.
- [x] 1.6 In `.github/workflows/release.yml`'s nonprod `apply` job, change `ARM_TENANT_ID: "1b4a4fed-fed8-4823-a8a0-3d5cea83d122"` to `ARM_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}`.
- [x] 1.7 In `.github/workflows/apply-prod.yml`, remove the `workflow_dispatch:` trigger block including its `gratibot_limit` input. The `on:` block should retain only `release: types: [created]`.
- [x] 1.8 In `.github/workflows/apply-prod.yml`, remove the `if: github.event_name == 'push' || contains(fromJSON('["Pactionly", "gesparza3"]'), github.actor)` line from the `build` job.
- [x] 1.9 In `.github/workflows/apply-prod.yml`'s `plan` job, remove the `TF_VAR_gratibot_limit: ${{ inputs.gratibot_limit }}` line from the step's `env:` block.
- [x] 1.10 In `.github/workflows/apply-prod.yml`'s `apply` job, remove the `GRATIBOT_LIMIT: ${{ inputs.gratibot_limit }}` line (the typo'd env entry) from the step's `env:` block.
- [x] 1.11 In `.github/workflows/apply-prod.yml`'s `plan` and `apply` jobs, change each `ARM_TENANT_ID: "1b4a4fed-fed8-4823-a8a0-3d5cea83d122"` line to `ARM_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}`.
- [x] 1.12 In `.github/workflows/apply-prod.yml`, add a YAML comment immediately above `environment: name: "plan"` reading: `# 'plan' scopes OIDC to a read-only Azure identity, distinct from the elevated identity used by the 'prod' environment.`.
- [x] 1.13 In `.github/workflows/pull-request.yaml`, replace `${{ needs.build.outputs.docker_tag }}` with `${{ needs.setup.outputs.docker-tag }}` in both the `validate` job's `TF_VAR_gratibot_image` value and the `plan` job's `TF_VAR_gratibot_image` value.
- [x] 1.14 In `.github/workflows/pull-request.yaml`'s `validate` job, change `needs: build` to `needs: setup` (the job only consumes the `setup` output, not any `build` output).
- [x] 1.15 In `.github/workflows/pull-request.yaml`'s `plan` job, change `ARM_TENANT_ID: "1b4a4fed-fed8-4823-a8a0-3d5cea83d122"` to `ARM_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}`.
- [x] 1.16 In `.github/workflows/pull-request.yaml`, add a top-level `concurrency:` block (sibling to `on:`, `env:`, `permissions:`, `jobs:`) with `group: ${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: true`.
- [x] 1.17 Run `npm run lint` locally, stage the three workflow files, and create the Unit 1 commit on `ci/03-cicd-hardening` with a message starting `fix(ci):` (e.g., `fix(ci): remove dead gates, typo'd env, and broken refs from deploy workflows`). Do **not** push yet — Unit 7 handles the push.

---

### [x] 2.0 Tool install migration to mise + terragrunt-action

Add a `mise.toml` at the repo root pinning `opentofu` and `terragrunt` versions, and
replace the `opentofu/setup-opentofu` + raw `wget` Terragrunt install sequence in all
three deploy/PR workflows with `gruntwork-io/terragrunt-action` in install-only mode.
Bump Terragrunt from `0.72.0` to at least `0.77.22` (action minimum), rename deprecated
Terragrunt CLI flags (`--terragrunt-non-interactive` → `--non-interactive`,
`--terragrunt-no-auto-init` → `--no-auto-init`), and label the previously unlabeled
`include {}` blocks in the two `terragrunt.hcl` files as `include "root" { ... }`.
Lands before or together with Unit 3 per the spec's Key Ordering (§7.2).

#### 2.0 Proof Artifact(s)

- File: `mise.toml` exists at the repo root with `opentofu` and `terragrunt` version pins (Terragrunt ≥ `0.77.22`) — demonstrates single source of truth for tool versions exists. Captured as `03-proofs/mise.toml` by Task 2.14.
- Diff: Unit 2 commit diff across `.github/workflows/release.yml`, `.github/workflows/apply-prod.yml`, and `.github/workflows/pull-request.yaml` shows the `opentofu/setup-opentofu` + `wget` Terragrunt install sequence replaced by a single `gruntwork-io/terragrunt-action` step (pinned to a SHA with a `# vX.Y.Z` comment) in all three workflows, with `tofu_version` and `tg_version` env entries removed — demonstrates uniform migration. Captured in Task 7.11's full diff.
- Diff: Unit 2 commit diff across `infra/terragrunt/**/*.hcl` shows the unlabeled `include {}` blocks renamed to `include "root" { ... }` — demonstrates deprecation cleanup.
- CI run (PR-level): PR `fmt`, `validate`, and `plan` jobs in `pull-request.yaml` complete using `gruntwork-io/terragrunt-action` — demonstrates uniform behavior across workflows. Captured as `03-proofs/2.0-pr-run.txt` by Task 7.2.
- CI run (post-merge): Post-merge nonprod `terragrunt apply` job in `release.yml` completes using the action-installed binary at the new pinned version, with no deprecation warnings about unlabeled `include` or old flag names in the log — demonstrates the migration is functional. Captured as `03-proofs/2.0-release-run.txt` by Task 7.6.

#### 2.0 Tasks

- [x] 2.1 Continue on branch `ci/03-cicd-hardening` (do not create a new branch). The previous Unit 1 commit is the parent.
- [x] 2.2 Create `mise.toml` at the repository root with two pins: `opentofu = "1.9.4"` (latest patch within `~1.9`) and `terragrunt = "0.77.22"` (action minimum).
- [x] 2.3 Pinned `gruntwork-io/terragrunt-action@53dbdc2c3d43e82bf3bae10b734a968196442bec # v3.2.0` across all three workflows.
- [x] 2.4 In `.github/workflows/release.yml`, remove the `tofu_version: '~1.9'` and `tg_version: '0.72.0'` entries from the top-level `env:` block.
- [x] 2.5 In `.github/workflows/release.yml`'s `apply` job, replace the two steps `Setup Tofu` (using `opentofu/setup-opentofu`) and `Setup Terragrunt` (raw `wget`) with a single step using `gruntwork-io/terragrunt-action` in install-only mode (no `tg_command` argument). The step should not reference `${{ env.tofu_version }}` or `${{ env.tg_version }}`.
- [x] 2.6 In `.github/workflows/release.yml`'s `apply` job's `Deploy Gratibot to Nonprod` step, rename `--terragrunt-non-interactive` to `--non-interactive`.
- [x] 2.7 In `.github/workflows/apply-prod.yml`, remove the `tofu_version` and `tg_version` entries from the top-level `env:` block.
- [x] 2.8 In `.github/workflows/apply-prod.yml`'s `plan` job and `apply` job, replace each `Setup Tofu` + `Setup Terragrunt` pair with a single `gruntwork-io/terragrunt-action` install-only step (same pinned SHA as 2.3).
- [x] 2.9 In `.github/workflows/apply-prod.yml`'s `apply` job's `Deploy Gratibot to Prod` step, rename `--terragrunt-non-interactive` to `--non-interactive`.
- [x] 2.10 In `.github/workflows/pull-request.yaml`, remove the `tofu_version` and `tg_version` entries from the top-level `env:` block.
- [x] 2.11 In `.github/workflows/pull-request.yaml`'s `fmt`, `validate`, and `plan` jobs, replace each `Setup Tofu` + (for `validate`/`plan`) `Setup Terragrunt` step sequence with a single `gruntwork-io/terragrunt-action` install-only step (same pinned SHA).
- [x] 2.12 In `.github/workflows/pull-request.yaml`'s `validate` job's `Terraform validate check` step, rename `--terragrunt-no-auto-init` to `--no-auto-init`.
- [x] 2.13 In `infra/terragrunt/nonprod/gratibot/terragrunt.hcl`, change the line `include {` to `include "root" {` (closing brace unchanged). Preserve the block body exactly.
- [x] 2.14 In `infra/terragrunt/prod/gratibot/terragrunt.hcl`, apply the same relabel as 2.13. Copy the final `mise.toml` to `docs/specs/03-spec-ci-cd-hardening/03-proofs/mise.toml`.
- [x] 2.15 Run `npm run lint`, stage the changes, and create the Unit 2 commit on `ci/03-cicd-hardening` with a message starting `chore(ci):` (e.g., `chore(ci): migrate tofu/terragrunt install to mise + gruntwork terragrunt-action`). Do not push.

---

### [x] 3.0 CI consolidation into single ci.yaml

Collapse `.github/workflows/test.yaml`, `.github/workflows/lint.yaml`, and
`.github/workflows/codeql-analysis.yml` into a new `.github/workflows/ci.yaml` with
three jobs (`lint`, `test`, `codeql`), top-level `permissions: contents: read`, a
top-level `concurrency` block with `cancel-in-progress: true`, `actions/setup-node`
with `cache: 'npm'` and `node-version: 24` for `lint`/`test`, and a
`github.event_name != 'schedule'` guard on `lint`/`test` so the weekly cron only
runs `codeql`. Drops the stale `pathsIgnore` matrix entry from CodeQL. Deletes the
three legacy workflow files. Coordinates with the human-gated branch-protection
required-check rename (Out-of-Repo Prerequisite #3), which Task 7.4 performs before
merge.

#### 3.0 Proof Artifact(s)

- File: `.github/workflows/ci.yaml` exists with three jobs (`lint`, `test`, `codeql`), `push` + `pull_request` + `schedule: '15 11 * * 5'` triggers, top-level `permissions: contents: read`, top-level `concurrency` with `cancel-in-progress: true`, `actions/setup-node` `cache: 'npm'` + `node-version: 24` on `lint`/`test`, schedule guard on `lint`/`test`, and CodeQL job-level permissions override (`actions: read`, `contents: read`, `security-events: write`) — demonstrates the consolidation shape. Captured as `03-proofs/ci.yaml` by Task 3.10.
- Files deleted: Unit 3 commit shows `.github/workflows/test.yaml`, `.github/workflows/lint.yaml`, and `.github/workflows/codeql-analysis.yml` removed — demonstrates legacy workflow cleanup. Captured in Task 7.11's full diff.
- CI run (PR-level): PR shows three check entries — `CI / lint`, `CI / test`, `CI / codeql` — all passing. Captured as `03-proofs/3.0-pr-run.txt` by Task 7.2.
- CI run (concurrency demo): A second push to the PR branch cancels the earlier `CI` run via the concurrency group. Captured as `03-proofs/3.0-concurrency-cancel.txt` by Task 7.3.
- CI run (schedule): A scheduled cron trigger shows only `codeql` executing while `lint` and `test` are marked `skipped` — demonstrates the schedule guard. Captured as `03-proofs/3.0-schedule-run.txt` by Task 7.10.
- Human gate evidence: Screenshot of the repo's branch-protection settings on `main` showing `CI / lint`, `CI / test`, `CI / codeql` listed as required status checks and the old `test`, `lint`, `CodeQL / Analyze` checks removed. Captured as `03-proofs/3.0-branch-protection.png` by Task 7.4. Confirms Out-of-Repo Prerequisite #3.

#### 3.0 Tasks

- [x] 3.1 Continue on branch `ci/03-cicd-hardening`. The previous Unit 2 commit is the parent.
- [x] 3.2 Create `.github/workflows/ci.yaml` with `name: CI`, triggers `push: branches: [main]`, `pull_request: branches: [main]`, and `schedule: - cron: '15 11 * * 5'`.
- [x] 3.3 In `ci.yaml`, add top-level `permissions: contents: read` (workflow-level, applies to all jobs unless overridden).
- [x] 3.4 In `ci.yaml`, add top-level `concurrency:` block with `group: ${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: true`.
- [x] 3.5 In `ci.yaml`, add a `lint` job: `runs-on: ubuntu-latest`, `if: github.event_name != 'schedule'`, steps: `actions/checkout` (existing pinned SHA), `actions/setup-node` (existing pinned SHA) with `node-version: 24` and `cache: 'npm'`, then `npm ci`, then `npm run lint`.
- [x] 3.6 In `ci.yaml`, add a `test` job mirroring `lint` (same guard and setup) running `npm test` as the final step.
- [x] 3.7 In `ci.yaml`, add a `codeql` job with `runs-on: ubuntu-latest` and a job-level `permissions:` block `actions: read`, `contents: read`, `security-events: write`. Job should use the existing CodeQL action SHAs from `codeql-analysis.yml` for `init`, `autobuild`, and `analyze`, run only the `javascript` language matrix entry, and not declare the stale `pathsIgnore` matrix dimension.
- [x] 3.8 Delete `.github/workflows/test.yaml`.
- [x] 3.9 Delete `.github/workflows/lint.yaml`.
- [x] 3.10 Delete `.github/workflows/codeql-analysis.yml`. Copy the final `ci.yaml` to `docs/specs/03-spec-ci-cd-hardening/03-proofs/ci.yaml`.
- [x] 3.11 Run `npm run lint` and `npm test` locally to confirm both still pass (no source changes, so they should).
- [x] 3.12 Stage changes and create the Unit 3 commit on `ci/03-cicd-hardening` with a message starting `ci:` (e.g., `ci: consolidate lint, test, and codeql into a single ci.yaml with shared concurrency`). Do not push.

---

### [x] 4.0 Promote-don't-rebuild in apply-prod

Replace the `build` job in `apply-prod.yml` with a `promote` job that retags the
nonprod-validated image (`ghcr.io/liatrio/gratibot:<sha_short>`) to the release tag
(`ghcr.io/liatrio/gratibot:<release_tag>`) using `docker buildx imagetools create`,
with no local pull and no `docker build`/`docker push`. Resolves `sha_short` from the
commit associated with the triggering release so the image promoted is exactly the
image nonprod applied. Downstream `plan` and `apply` jobs continue to consume the
release tag in `TF_VAR_gratibot_image`. Lands with or after Unit 1 per spec §7.3.

#### 4.0 Proof Artifact(s)

- Diff: Unit 4 commit diff of `.github/workflows/apply-prod.yml` shows the `build` job replaced by a `promote` job containing a `docker buildx imagetools create` step, with no `docker build` or `docker push` step remaining anywhere in the file — demonstrates the promotion model is in place. Captured in Task 7.11's full diff.
- Registry inspection: `docker buildx imagetools inspect ghcr.io/liatrio/gratibot:<release_tag>` and `docker buildx imagetools inspect ghcr.io/liatrio/gratibot:<sha_short>` after the first post-merge release run return the same image digest — demonstrates identical-artifact promotion. Captured as `03-proofs/4.0-imagetools-inspect.txt` by Task 7.8.
- CI run (post-merge): First post-merge `release: created` event triggers `apply-prod.yml` and the `promote`, `plan`, and `apply` jobs all complete successfully. Captured as `03-proofs/4.0-prod-run.txt` by Task 7.7.

#### 4.0 Tasks

- [x] 4.1 Continue on branch `ci/03-cicd-hardening`. The previous Unit 3 commit is the parent.
- [x] 4.2 In `.github/workflows/apply-prod.yml`, rename the `build` job key to `promote` and change its `name:` to `"Promote image from nonprod"` (or similar).
- [x] 4.3 In the renamed `promote` job, add a `Resolve nonprod sha_short` step (`id: source`) that sets `sha_short=$(git rev-parse --short ${{ github.sha }})` as a step output. (The release event's `github.sha` is the commit the release tag points at — the same commit nonprod applied.)
- [x] 4.4 In the `promote` job, keep the `Generate tag` step (or equivalent) that sets the release tag output (`tag=${GITHUB_REF#refs/*/}`). Keep the `Log into registry` step.
- [x] 4.5 Replace the `Build image` and `Push image` steps with a single `Promote image` step that runs `docker buildx imagetools create -t $IMAGE_NAME:${{ steps.tag.outputs.tag }} $IMAGE_NAME:${{ steps.source.outputs.sha_short }}`. This step must not run `docker build` or `docker push`.
- [x] 4.6 Update the `promote` job's `outputs:` block so it exposes both the `docker_tag` (release tag, consumed by `plan`/`apply`) and `source_tag` (the `sha_short` it was promoted from, captured for traceability).
- [x] 4.7 Update the `plan` job's `needs: build` to `needs: promote` and its `TF_VAR_gratibot_image` to `"${{ env.IMAGE_PATH }}:${{ needs.promote.outputs.docker_tag }}"`.
- [x] 4.8 Update the `apply` job's `needs: [build, plan]` to `needs: [promote, plan]` and its `TF_VAR_gratibot_image` in the same way.
- [x] 4.9 Grep `.github/workflows/apply-prod.yml` for `docker build`, `docker push`, and `Build image` and confirm no remaining occurrences.
- [x] 4.10 Run `npm run lint` and create the Unit 4 commit on `ci/03-cicd-hardening` with a message starting `refactor(ci):` (e.g., `refactor(ci): promote nonprod image to release tag instead of rebuilding in apply-prod`). Do not push.

---

### [x] 5.0 GitHub App token migration in release.yml

Replace the long-lived `GRATIBOT_RELEASE_TOKEN` PAT in `release.yml`'s `Create Release`
step with a short-lived token minted by `actions/create-github-app-token` (pinned to a
SHA with a `# vX.Y.Z` comment per repo convention). Sources App ID from a repo variable
and private key from a repo secret (both established by Tasks 5.1 and 5.2 before the PR
is opened). After the migration is proven by a successful post-merge release run, Task
7.9 revokes `GRATIBOT_RELEASE_TOKEN` (Out-of-Repo Prerequisite #4). Independent of
Units 1–4 but gated on the App being created/installed first.

#### 5.0 Proof Artifact(s)

- Diff: Unit 5 commit diff of `.github/workflows/release.yml` shows the `Create Release` step now sources `GITHUB_TOKEN` from an `actions/create-github-app-token` step's output and no longer references `secrets.GRATIBOT_RELEASE_TOKEN` anywhere in the file — demonstrates the credential migration is encoded. Captured in Task 7.11's full diff.
- CI run (post-merge): Post-merge `release.yml` run shows the App-token step mints a token and `npm run release` (semantic-release) publishes a new version tag/GitHub Release using that token — demonstrates the new credential path works against `contents: write`, `issues: write`, and `pull-requests: write` permissions. Captured as `03-proofs/5.0-release-run.txt` by Task 7.6.
- Human gate evidence (App creation/install): Screenshot of the GitHub App's installation page on `liatrio/gratibot` showing the App installed with exactly `contents: write`, `issues: write`, and `pull-requests: write` repository permissions and no others. Captured as `03-proofs/5.0-app-install.png` by Task 5.1 (pre-flight). Confirms Out-of-Repo Prerequisite #1.
- Human gate evidence (PAT revocation): Screenshot of the repo's Settings → Secrets and variables → Actions → Secrets tab showing `GRATIBOT_RELEASE_TOKEN` is no longer present. Captured as `03-proofs/5.0-pat-revoked.png` by Task 7.9 (post-merge). Confirms Out-of-Repo Prerequisite #4. Secret values must not appear in any artifact.

#### 5.0 Tasks

- [~] 5.1 [HUMAN GATE] In the `liatrio` GitHub org settings, create a new GitHub App (name suggestion: `gratibot-release`) with exactly three repository permissions: `contents: write`, `issues: write`, `pull-requests: write`. No other permissions. Install the App on `liatrio/gratibot` only. Record the App ID and download a PEM private key. Capture a screenshot of the installation page (showing only those three permissions) to `docs/specs/03-spec-ci-cd-hardening/03-proofs/5.0-app-install.png`. (Out-of-Repo Prereq #1.) **Must complete before Unit 7 pushes the branch.**
- [~] 5.2 [HUMAN GATE] In `liatrio/gratibot` Settings → Secrets and variables → Actions: add a repo variable `RELEASE_APP_ID` set to the App ID from 5.1; add a repo secret `RELEASE_APP_PRIVATE_KEY` set to the PEM private key contents. The private key must never be committed or echoed in logs. **Must complete before Unit 7 pushes the branch.**
- [x] 5.3 Continue on branch `ci/03-cicd-hardening`. The previous Unit 4 commit is the parent.
- [x] 5.4 Pinned `actions/create-github-app-token@1b10c78c7865c340bc4f6099eb2f838309f1e8c3 # v3.1.1`.
- [x] 5.5 In `.github/workflows/release.yml`'s `release` job, insert a new step immediately before `Create Release` with `id: app-token` using `actions/create-github-app-token@<sha>` and inputs `app-id: ${{ vars.RELEASE_APP_ID }}` and `private-key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}`.
- [x] 5.6 In the same `release` job, change the `Create Release` step's `env.GITHUB_TOKEN` value from `${{ secrets.GRATIBOT_RELEASE_TOKEN }}` to `${{ steps.app-token.outputs.token }}`.
- [x] 5.7 Grep `.github/workflows/release.yml` for `GRATIBOT_RELEASE_TOKEN` and confirm zero remaining references.
- [x] 5.8 Run `npm run lint` and create the Unit 5 commit on `ci/03-cicd-hardening` with a message starting `ci:` (e.g., `ci: replace GRATIBOT_RELEASE_TOKEN PAT with short-lived GitHub App token`). Do not push.

---

### [x] 6.0 Backstage/TechDocs decommission

Delete the four files supporting the unused Backstage/TechDocs integration:
`.github/workflows/publish-techdocs-to-s3.yaml`, `catalog-info.yaml` (repo root),
`mkdocs.yml` (repo root), and `docs/index.md`. Leave the rest of `docs/` and all
`CLAUDE.md`/`AGENTS.md` cross-links intact. S3 bucket cleanup and Backstage catalog
deregistration are explicitly out of scope per spec Non-Goal #14. Independent of all
other units; committed last per the single-PR commit order.

#### 6.0 Proof Artifact(s)

- `git status` / diff: Unit 6 commit shows exactly the four files deleted and no other files in `docs/` removed — demonstrates the cleanup is correctly scoped. Captured as `03-proofs/6.0-git-status.txt` by Task 6.9 and in Task 7.11's full diff.
- Repo search: `grep -ril -E 'catalog-info|mkdocs|techdocs' .github/ 2>/dev/null` returns no in-repo hits in workflow files — demonstrates the integration is fully unwired. Captured as `03-proofs/6.0-grep-output.txt` by Task 6.7. (Hits in `docs/specs/03-spec-ci-cd-hardening/` itself are expected and acceptable, since this spec discusses the decommission.)
- Cross-link check: `grep -rn 'docs/index.md' . --exclude-dir=node_modules --exclude-dir=.git` returns no matches (or only spec-self-references) — demonstrates no surviving link points at the deleted landing page. Captured as `03-proofs/6.0-crosslink-check.txt` by Task 6.8.

#### 6.0 Tasks

- [x] 6.1 Continue on branch `ci/03-cicd-hardening`. The previous Unit 5 commit is the parent.
- [x] 6.2 Delete `.github/workflows/publish-techdocs-to-s3.yaml`.
- [x] 6.3 Delete `catalog-info.yaml` (repo root).
- [x] 6.4 Delete `mkdocs.yml` (repo root).
- [x] 6.5 Delete `docs/index.md`.
- [x] 6.6 Run `ls docs/` and confirm `ARCHITECTURE.md`, `DEVELOPMENT.md`, `TESTING.md`, `deployment.md`, `local_dev/`, and `specs/` are all still present.
- [x] 6.7 Run `grep -ril -E 'catalog-info|mkdocs|techdocs' .github/ 2>/dev/null` and confirm no matches. Capture output to `docs/specs/03-spec-ci-cd-hardening/03-proofs/6.0-grep-output.txt`.
- [x] 6.8 Run `grep -rn 'docs/index.md' . --exclude-dir=node_modules --exclude-dir=.git` and confirm no matches outside the `docs/specs/03-spec-ci-cd-hardening/` directory. Capture output to `docs/specs/03-spec-ci-cd-hardening/03-proofs/6.0-crosslink-check.txt`.
- [x] 6.9 Capture `git status --porcelain` showing the four deletions (plus any new proof files) to `docs/specs/03-spec-ci-cd-hardening/03-proofs/6.0-git-status.txt`.
- [x] 6.10 Run `npm run lint` and create the Unit 6 commit on `ci/03-cicd-hardening` with a message starting `chore:` (e.g., `chore: remove unused Backstage/TechDocs integration files`). Do not push yet — Unit 7 handles the push.

---

### [ ] 7.0 Integration PR and post-merge verification

Push the `ci/03-cicd-hardening` branch (containing six per-unit commits), open the
consolidated PR, capture PR-level CI evidence, perform the pre-merge branch-protection
rename (Out-of-Repo Prereq #3), merge, and then capture all post-merge runtime evidence
(release.yml and apply-prod.yml runs, image-digest identity, scheduled-cron behavior)
and complete the post-merge PAT revocation (Out-of-Repo Prereq #4). This parent task
owns the cross-unit integration work that was previously spread across per-unit "open
PR" / "after merge" sub-tasks; individual units' Proof Artifact(s) bullets point here
for runtime captures.

#### 7.0 Proof Artifact(s)

- PR URL: The single PR created by Task 7.1 covering all six unit commits. Captured as `03-proofs/7.0-pr-url.txt`.
- PR check summary: Screenshot or copy of the PR's checks tab showing `CI / lint`, `CI / test`, `CI / codeql`, `pull request / fmt`, `pull request / validate`, `pull request / plan`, and the reusable docker-build check all passing. Captured as `03-proofs/7.0-pr-checks.png` (or `.txt` for the URL list).
- Consolidated diff: Full `git diff main..ci/03-cicd-hardening` captured as `03-proofs/7.0-full-diff.patch` — this also serves as the source for each unit's diff-level evidence.
- Human gate evidence (branch-protection rename): Screenshot captured as `03-proofs/3.0-branch-protection.png` (Task 7.4). Confirms Out-of-Repo Prereq #3.
- Post-merge release run: URL captured as `03-proofs/1.0-release-run.txt`, `03-proofs/2.0-release-run.txt`, and `03-proofs/5.0-release-run.txt` (same run, referenced by three units).
- Post-merge apply-prod run: URL captured as `03-proofs/4.0-prod-run.txt` after the first release event.
- imagetools inspect: Captured as `03-proofs/4.0-imagetools-inspect.txt` showing both tags resolve to the same digest.
- Scheduled-cron evidence: URL captured as `03-proofs/3.0-schedule-run.txt` from the next Friday 11:15 UTC run (or earlier if a workflow_dispatch equivalent is available).
- Human gate evidence (PAT revocation): Screenshot captured as `03-proofs/5.0-pat-revoked.png` (Task 7.9). Confirms Out-of-Repo Prereq #4.

#### 7.0 Tasks

- [ ] 7.1 Confirm all pre-flight human gates are complete: `AZURE_TENANT_ID` variable (Task 1.1), GitHub App installed with `contents: write` + `issues: write` + `pull-requests: write` (Task 5.1), and `RELEASE_APP_ID` variable + `RELEASE_APP_PRIVATE_KEY` secret (Task 5.2). If any is missing, stop and complete it; otherwise CI will fail.
- [ ] 7.2 Push branch `ci/03-cicd-hardening` to origin. Open a PR targeting `main` with title `ci: harden and modernize CI/CD pipeline (spec 03)` and a body that links to `docs/specs/03-spec-ci-cd-hardening/03-spec-ci-cd-hardening.md`, summarizes the six units, and calls out the `[HUMAN GATE]` tasks already completed and still pending. Wait for CI to run. Capture the PR URL to `docs/specs/03-spec-ci-cd-hardening/03-proofs/7.0-pr-url.txt` and the checks view to `docs/specs/03-spec-ci-cd-hardening/03-proofs/7.0-pr-checks.png`. Extract unit-specific PR-run URLs (for `pull-request.yaml` `validate`+`plan`) to `03-proofs/1.0-pr-run.txt`, `03-proofs/2.0-pr-run.txt`, and the `CI` workflow run URL to `03-proofs/3.0-pr-run.txt`.
- [ ] 7.3 Push a trivial second commit to the PR branch (e.g., add a blank line to an already-modified workflow file or a comment tweak) and confirm that the earlier `CI` workflow run on the branch is cancelled by the `cancel-in-progress: true` concurrency group. Capture the cancelled-run URL or a screenshot to `docs/specs/03-spec-ci-cd-hardening/03-proofs/3.0-concurrency-cancel.txt`. Amend or keep the second commit as appropriate (either is fine — Unit 3's cancel-in-progress is the only thing being demonstrated).
- [ ] 7.4 [HUMAN GATE] Once Unit 3's commit has run on the PR branch and `CI / lint`, `CI / test`, `CI / codeql` check entries are observable on the PR: in Settings → Branches → Branch protection on `main`, remove the required checks `test`, `lint`, and `CodeQL / Analyze` and add `CI / lint`, `CI / test`, `CI / codeql`. Capture a screenshot to `docs/specs/03-spec-ci-cd-hardening/03-proofs/3.0-branch-protection.png`. (Out-of-Repo Prereq #3.) **Must complete before 7.5.**
- [ ] 7.5 Request maintainer review. Once approved, merge the PR using a merge strategy that preserves per-unit commits (`Create a merge commit` or `Rebase and merge`; **do not squash**). If branch-protection only permits `Squash and merge`, update branch protection temporarily or coordinate with the maintainer, since the spec's bisectability guarantee depends on preserved per-unit commits.
- [ ] 7.6 Capture the post-merge `release.yml` run URL (covering nonprod apply, GitHub App token mint, and semantic-release publish) to three locations (same URL, referenced by three units): `docs/specs/03-spec-ci-cd-hardening/03-proofs/1.0-release-run.txt`, `docs/specs/03-spec-ci-cd-hardening/03-proofs/2.0-release-run.txt`, and `docs/specs/03-spec-ci-cd-hardening/03-proofs/5.0-release-run.txt`. Verify the run log contains no Terragrunt deprecation warnings about unlabeled `include` or `--terragrunt-*` flags (Unit 2 evidence).
- [ ] 7.7 After semantic-release emits a GitHub Release, capture the resulting `apply-prod.yml` run URL showing `promote` + `plan` + `apply` all succeeded and no `docker build` or `docker push` appears in logs, to `docs/specs/03-spec-ci-cd-hardening/03-proofs/4.0-prod-run.txt`.
- [ ] 7.8 From a terminal authenticated to GHCR, run `docker buildx imagetools inspect ghcr.io/liatrio/gratibot:<release_tag>` and `docker buildx imagetools inspect ghcr.io/liatrio/gratibot:<sha_short>` using the exact release tag and source `sha_short` from the 7.7 run. Save the two (sanitized — no tokens) outputs to `docs/specs/03-spec-ci-cd-hardening/03-proofs/4.0-imagetools-inspect.txt`. Confirm both report the same image digest.
- [ ] 7.9 [HUMAN GATE] After the 7.6 release run succeeds end-to-end with the App token: delete the `GRATIBOT_RELEASE_TOKEN` repo secret, then revoke the PAT in its owner's GitHub account. Capture a screenshot of the Actions secrets tab (showing `GRATIBOT_RELEASE_TOKEN` absent) to `docs/specs/03-spec-ci-cd-hardening/03-proofs/5.0-pat-revoked.png`. (Out-of-Repo Prereq #4.)
- [ ] 7.10 On the next scheduled cron firing (Friday 11:15 UTC), capture the `CI` workflow run URL showing only `codeql` ran and `lint`/`test` were marked `skipped`. Save to `docs/specs/03-spec-ci-cd-hardening/03-proofs/3.0-schedule-run.txt`. (This evidence may lag up to seven days behind the merge; note the capture date.)
- [ ] 7.11 Generate the final consolidated diff for the PR: from a fresh clone or `main`-anchored reference, run `git diff <merge-base>..<merge-commit> > docs/specs/03-spec-ci-cd-hardening/03-proofs/7.0-full-diff.patch`. This artifact sources each unit's diff-level evidence bullet.
