# 03-spec-ci-cd-hardening.md

## Introduction/Overview

Gratibot's CI/CD pipeline has accumulated latent bugs (dead `if:` gates,
a typo'd env var causing plan/apply divergence, a broken `needs.*.outputs`
reference), scattered validation workflows, duplicated secret handling,
and dead Backstage/TechDocs wiring. This spec hardens and modernizes the
pipeline in a single coordinated set of changes: fix the bugs, consolidate
the CI-validation workflows, migrate tool installation to `mise` via
`gruntwork-io/terragrunt-action`, replace a long-lived release PAT with a
short-lived GitHub App token, promote images between environments instead
of rebuilding them, and delete the unused Backstage integration. The goal
is a correct, auditable, single-person-independent pipeline with fewer
moving parts.

## Goals

- Eliminate latent deploy-path bugs that can cause plan/apply divergence,
  broken template references, or unreachable access-control conditions.
- Remove single-person dependencies from the release and deploy paths
  (the `Pactionly`/`gesparza3` actor list and the `GRATIBOT_RELEASE_TOKEN`
  PAT).
- Collapse three CI-validation workflows into one `ci.yaml` with a shared
  concurrency group, weekly CodeQL schedule, and cached Node installs.
- Guarantee that the image deployed to prod is the exact image validated
  in nonprod by retagging at the registry rather than rebuilding.
- Decommission the unused Backstage/TechDocs integration and remove its
  four associated files from the repo.

## User Stories

- **As a Gratibot maintainer**, I want deploy workflows to be free of
  dead conditionals and typo'd env vars so that a Terragrunt plan in prod
  matches the apply step and I can trust what CI says it is doing.
- **As a Gratibot maintainer**, I want the release workflow to use a
  short-lived GitHub App token rather than a personal PAT so that
  cutting a release does not depend on one specific person's account
  and there is no long-lived credential to rotate.
- **As a Gratibot contributor**, I want lint, test, and CodeQL to run
  under a single workflow with a shared concurrency group so that
  overlapping pushes cancel the older run and the PR status checks are
  predictable.
- **As a Gratibot maintainer**, I want prod to deploy the exact image
  that was validated in nonprod so that promotion is a registry retag
  rather than a rebuild that can diverge from the tested artifact.
- **As a Gratibot maintainer**, I want tool versions (OpenTofu and
  Terragrunt) defined once in `mise.toml` so that CI workflows stop
  drifting against each other and install steps use checksum-validated
  binaries.
- **As a Gratibot maintainer**, I want the unused Backstage/TechDocs
  publishing workflow and its sibling files deleted so that they stop
  showing up in CI logs and contributor searches.

## Demoable Units of Work

### Unit 1: Deploy-workflow correctness fixes

**Purpose:** Fix the latent bugs in the existing deploy and PR workflows
so that subsequent structural changes land on a correct baseline. Scoped
to edits within existing `release.yml`, `apply-prod.yml`, and
`pull-request.yaml`.

**Functional Requirements:**

- The system shall remove the `if: github.event_name == 'push' ||
  contains(fromJSON('["Pactionly", "gesparza3"]'), github.actor)`
  conditional from the `build` job in `release.yml` and the `build`
  (now promote) job in `apply-prod.yml`, because access control is
  enforced by the workflow triggers and the `prod` environment's
  manual approval, not by actor allow-lists.
- The system shall remove the `workflow_dispatch` trigger, the
  `gratibot_limit` input definition, the `TF_VAR_gratibot_limit` env
  entry, and the typo'd `GRATIBOT_LIMIT` env entry from both
  `release.yml` and `apply-prod.yml`. The daily recognition limit is
  controlled exclusively by the Terraform variable default, which is
  changed by editing `infra/terragrunt/{nonprod,prod}/environment.yaml`.
- The system shall replace references to `needs.build.outputs.docker_tag`
  in the `validate` and `plan` jobs of `pull-request.yaml` with
  `needs.setup.outputs.docker-tag`. The `validate` job shall no longer
  declare `needs: build`, since it does not consume build outputs.
- The system shall replace the inlined Azure tenant ID
  (`1b4a4fed-fed8-4823-a8a0-3d5cea83d122`) in `release.yml`,
  `apply-prod.yml`, and `pull-request.yaml` with `${{
  vars.AZURE_TENANT_ID }}`. The repository variable
  `AZURE_TENANT_ID` is an out-of-repo prerequisite and is recorded in
  the "Out-of-Repo Prerequisites" section below.
- The system shall add a clarifying comment above the `environment:
  name: "plan"` declaration in `apply-prod.yml` stating that this
  environment scopes OIDC to a read-only Azure identity (distinct from
  the elevated identity used by the `prod` environment).
- The system shall add a top-level `concurrency` block to
  `pull-request.yaml` using `group: ${{ github.workflow }}-${{
  github.ref }}` and `cancel-in-progress: true`. Existing
  `tf-nonprod`/`tf-prod` concurrency groups on deploy workflows are
  left unchanged and shall not use `cancel-in-progress` (queued applies
  are the intended behavior).

**Proof Artifacts:**

- Diff: `release.yml`, `apply-prod.yml`, and `pull-request.yaml` show
  the dead `if:` gate removed, `workflow_dispatch` + `gratibot_limit`
  gone, tenant ID replaced with `vars.AZURE_TENANT_ID`, and the PR
  workflow's concurrency block added — demonstrates each requirement
  is encoded.
- CI run: A pull request exercising `pull-request.yaml` completes the
  `validate` and `plan` jobs with the correct `setup.outputs.docker-tag`
  value interpolated into the resulting image reference —
  demonstrates the `needs` fix works end-to-end.
- Deploy run: A merge-to-`main` triggers `release.yml` and runs the
  nonprod `apply` job without relying on `workflow_dispatch` inputs —
  demonstrates trigger simplification did not break the push path.

### Unit 2: Tool install migration to mise + terragrunt-action

**Purpose:** Replace the hand-rolled `wget` install of Terragrunt and
the `opentofu/setup-opentofu` action with `gruntwork-io/terragrunt-action`
in install-only mode, backed by a single `mise.toml` at the repo root.
This gives one source of truth for tool versions across every workflow
and adds checksum validation on install.

**Functional Requirements:**

- The system shall add a `mise.toml` file at the repository root that
  pins `opentofu` and `terragrunt` versions. The Terragrunt version
  must be at least `0.77.22` (the minimum required by
  `gruntwork-io/terragrunt-action`). OpenTofu shall be pinned to a
  version compatible with the existing `~1.9` constraint.
- The system shall replace the `opentofu/setup-opentofu` step and the
  raw `wget` Terragrunt install step in `release.yml`, `apply-prod.yml`,
  and `pull-request.yaml` with `gruntwork-io/terragrunt-action` used in
  install-only mode (no `tg_command` argument).
- The system shall remove the workflow-level `tofu_version` and
  `tg_version` env entries from all three workflows, since the
  versions now live in `mise.toml`.
- The system shall rename deprecated Terragrunt CLI flags in the
  same three workflows as part of this unit:
  `--terragrunt-non-interactive` → `--non-interactive`,
  `--terragrunt-no-auto-init` → `--no-auto-init`. The old flag names
  still work on `0.77.22` but emit deprecation warnings and are slated
  for removal in a future major version.
- The system shall label the unlabeled `include {}` block in
  `infra/terragrunt/nonprod/gratibot/terragrunt.hcl` and
  `infra/terragrunt/prod/gratibot/terragrunt.hcl` as
  `include "root" { ... }`. The unlabeled form still works on
  `0.77.22` but emits deprecation warnings. Other Terragrunt HCL
  deprecations (e.g. `find_in_parent_folders()` without an argument)
  are left alone in this spec to keep scope contained.
- The `mise.toml` migration shall land before or together with the
  CI consolidation in Unit 3, so that all workflows use the same
  tool-install mechanism from the moment consolidation ships.

**Proof Artifacts:**

- File: `mise.toml` present at repo root with `opentofu` and
  `terragrunt` pins — demonstrates single source of truth exists.
- Diff: All three workflows show the `opentofu/setup-opentofu` +
  `wget` Terragrunt sequence replaced by a single
  `gruntwork-io/terragrunt-action` step — demonstrates migration is
  uniform.
- CI run: A nonprod `terragrunt apply` completes using the
  action-installed Terragrunt binary — demonstrates the migration is
  functional against the real infra path.

### Unit 3: CI consolidation (lint + test + codeql → ci.yaml)

**Purpose:** Collapse the three existing CI-validation workflows
(`test.yaml`, `lint.yaml`, `codeql-analysis.yml`) into a single
`ci.yaml` with consistent triggers, workflow-level read-only
permissions, shared concurrency, and Node cache.

**Functional Requirements:**

- The system shall create `.github/workflows/ci.yaml` containing three
  jobs: `lint`, `test`, and `codeql` (plus room for future additions).
- The workflow shall trigger on `push: branches: [main]`,
  `pull_request: branches: [main]`, and `schedule` (weekly cron
  inherited from the existing CodeQL config: `15 11 * * 5`).
- The workflow shall declare top-level `permissions: contents: read`.
  The `codeql` job shall override that block locally with the
  permissions CodeQL currently requires (`actions: read`, `contents:
  read`, `security-events: write`).
- The workflow shall declare a top-level `concurrency` block with
  `group: ${{ github.workflow }}-${{ github.ref }}` and
  `cancel-in-progress: true`.
- The `lint` and `test` jobs shall use `actions/setup-node` with
  `cache: 'npm'` and `node-version: 24`.
- The `lint` and `test` jobs shall be guarded by `if:
  github.event_name != 'schedule'` so that the weekly cron executes
  only the `codeql` job.
- The `codeql` job shall drop the stale `pathsIgnore: [ "**/middleware" ]`
  matrix entry (it is not a valid CodeQL matrix dimension in the
  current setup).
- The system shall delete `.github/workflows/test.yaml`,
  `.github/workflows/lint.yaml`, and
  `.github/workflows/codeql-analysis.yml` once `ci.yaml` is in place.
- Branch-protection required-check names must be updated after
  rollout: the old names (`test`, `lint`, `CodeQL / Analyze`) are
  replaced by `CI / lint`, `CI / test`, `CI / codeql`. This is an
  out-of-repo step and is tracked in the "Out-of-Repo Prerequisites"
  section.

**Proof Artifacts:**

- File: `.github/workflows/ci.yaml` exists with the three jobs and the
  guards described above — demonstrates the consolidation shape.
- Files deleted: `test.yaml`, `lint.yaml`, `codeql-analysis.yml` are
  absent from `.github/workflows/` — demonstrates cleanup.
- CI run: A PR shows three check entries (`CI / lint`, `CI / test`,
  `CI / codeql`) all passing, and a subsequent push to the same PR
  branch cancels the older run via concurrency — demonstrates
  consolidation + concurrency work end-to-end.
- CI run: A scheduled (cron) run shows only `codeql` executing and
  `lint`/`test` marked skipped — demonstrates the schedule guard.

### Unit 4: Promote-don't-rebuild in apply-prod

**Purpose:** Make prod deploy the exact image that nonprod validated,
by retagging the nonprod `sha_short` image at the registry rather than
running `docker build` again in `apply-prod.yml`.

**Functional Requirements:**

- The system shall replace the `build` job in `apply-prod.yml` with a
  `promote` job that retags the nonprod image
  (`ghcr.io/liatrio/gratibot:<sha_short>`) to the release tag
  (`ghcr.io/liatrio/gratibot:<release_tag>`) using `docker buildx
  imagetools create`. The step shall not pull layers locally and shall
  not run `docker build`.
- The promote job shall resolve the source `sha_short` from the commit
  associated with the triggering release, so the image being promoted
  is the image that nonprod applied.
- The release tag shall be the Git tag name stripped of its `refs/*/`
  prefix, matching the existing `${GITHUB_REF#refs/*/}` behavior.
- The downstream `plan` and `apply` jobs in `apply-prod.yml` shall
  continue to consume the promoted release tag as the value of
  `TF_VAR_gratibot_image`.
- `release.yml` remains the single build-and-push point for images.
  `apply-prod.yml` shall not contain a `docker build` or `docker push`
  step after this change.
- The promote change shall land with or after the Azure tenant variable
  migration in Unit 1, to avoid touching the same env blocks twice.

**Proof Artifacts:**

- Diff: `apply-prod.yml` shows the `build` job replaced by a `promote`
  job with a `docker buildx imagetools create` step and no `docker
  build` or `docker push` — demonstrates the promotion model.
- Registry inspection: The GHCR package for `gratibot` shows the
  release-tagged manifest pointing to the same image digest as the
  nonprod `sha_short` tag after a full release run — demonstrates
  identical artifact promotion.
- Deploy run: A release event triggers `apply-prod.yml`, and the plan
  and apply jobs successfully reference the retagged image —
  demonstrates the end-to-end prod path works against the promoted
  image.

### Unit 5: GitHub App token migration

**Purpose:** Replace the long-lived `GRATIBOT_RELEASE_TOKEN` PAT used
by `release.yml`'s `Create Release` step with a short-lived token
minted from an org-level GitHub App, removing the single-person
dependency and the long-lived credential.

**Functional Requirements:**

- The system shall replace the `GITHUB_TOKEN: ${{
  secrets.GRATIBOT_RELEASE_TOKEN }}` line in `release.yml`'s
  `Create Release` step with a short-lived token minted by
  `actions/create-github-app-token` at workflow run time.
- The `actions/create-github-app-token` step shall read the App ID and
  private key from repo-scoped secrets/variables established as
  out-of-repo prerequisites.
- After the migration is merged, the `GRATIBOT_RELEASE_TOKEN` secret
  shall be revoked (removed from repo secrets, and the PAT itself
  revoked in its owner's GitHub account). Revocation is an out-of-repo
  step and is listed in the "Out-of-Repo Prerequisites" section.
- The GitHub App shall be granted exactly the following repository
  permissions and no others: `contents: write` (to create the GitHub
  Release and push the version tag), `issues: write` (for
  semantic-release auto-comments on closed issues), and
  `pull-requests: write` (for semantic-release auto-comments on merged
  PRs). `packages: write` is not required because the image-push step
  uses `secrets.GITHUB_TOKEN`, not the App token. No branch-protection
  bypass is required because semantic-release is configured without
  `@semantic-release/git` and therefore does not push commits to
  `main`. Setting these permissions on the App is an out-of-repo
  step performed by the org admin.

**Proof Artifacts:**

- Diff: `release.yml` shows the `Create Release` step now sources
  `GITHUB_TOKEN` from `actions/create-github-app-token` output and no
  longer references `secrets.GRATIBOT_RELEASE_TOKEN` — demonstrates
  the migration.
- Deploy run: A merge to `main` runs `release.yml` end-to-end and
  publishes a semantic-release version using the App token —
  demonstrates the new credential path works.
- Settings evidence: The `GRATIBOT_RELEASE_TOKEN` secret is no longer
  listed under repo secrets — demonstrates revocation completed
  (captured as a screenshot in the spec's proofs folder; the secret
  value itself shall never be committed).

### Unit 6: Backstage/TechDocs decommission

**Purpose:** Remove the unused Backstage/TechDocs publishing workflow
and its sibling files so they stop appearing in CI runs, contributor
searches, and maintenance surface area.

**Functional Requirements:**

- The system shall delete `.github/workflows/publish-techdocs-to-s3.yaml`.
- The system shall delete `catalog-info.yaml` at the repo root.
- The system shall delete `mkdocs.yml` at the repo root.
- The system shall delete `docs/index.md` (its role was a TechDocs
  landing page).
- The system shall leave the rest of `docs/` untouched. `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `TESTING.md`, `deployment.md`, and `local_dev/`
  are cross-linked from `CLAUDE.md` and from each other and remain in
  place.
- Cleanup of the S3 bucket
  (`s3://backstage-liatrio-techdocs/<gratibot-path>`) and Backstage
  catalog deregistration are explicitly out of scope for this repo
  (see "Non-Goals").

**Proof Artifacts:**

- `git status` / diff: Shows the four files deleted and no other docs
  files removed — demonstrates the scoped cleanup.
- Repo search: Searching the repo for `catalog-info`, `mkdocs`, or
  `techdocs` returns no hits in workflow files or repo root —
  demonstrates the integration is fully unwired.

## Non-Goals (Out of Scope)

1. **Path-based triggers to skip jobs on layer-specific PRs** —
   deferred. The interaction between native `paths:` filters and
   required status checks needs more design before landing.
2. **Smoke-test gate between nonprod apply and release creation** —
   dropped.
3. **Plan-then-apply-from-plan pattern in deploy workflows** — dropped.
4. **`terragrunt plan` before nonprod apply** — dropped.
5. **Making `lint`/`test` explicit `needs:` prerequisites of deploy
   workflows** — dropped; branch protection enforces this on PRs.
6. **Adding `timeout-minutes` on jobs** — dropped.
7. **Renovate auto-merge workflow** — already implemented in
   `renovate.json`; no action needed here.
8. **Blocking PR Docker image push** — already the default behavior of
   the reusable `liatrio/github-workflows/docker-build.yaml` workflow.
9. **Adding `hadolint` Dockerfile linter** — dropped.
10. **Adding Trivy or Grype image scanning** — dropped.
11. **Splitting `release.yml` into separate `deploy-nonprod.yaml` +
    `release.yaml` files** — dropped; the two-file split
    (`release.yml` + `apply-prod.yml`) stays.
12. **Consolidating Docker build logic onto the reusable
    `liatrio/github-workflows/docker-build.yaml`** — dropped.
    Unit 4 (promote-don't-rebuild) removes the duplication that
    motivated it.
13. **Removing the `plan` GitHub Environment from `apply-prod.yml`** —
    retracted; the `plan` environment provides legitimate OIDC
    scoping to a read-only Azure identity.
14. **Cleaning up the stale `s3://backstage-liatrio-techdocs/` content
    or deregistering Gratibot from the Backstage catalog** — out of
    scope; Unit 6 only deletes in-repo files.

## Design Considerations

No specific UI/UX design requirements. This spec is pure CI/CD
plumbing. The only "interface" changes visible to contributors are:

- PR check names change (`test`, `lint`, `CodeQL / Analyze` →
  `CI / lint`, `CI / test`, `CI / codeql`). Branch protection must be
  updated to match; see Out-of-Repo Prerequisites.
- `workflow_dispatch` disappears from `release.yml` and
  `apply-prod.yml`; the daily-limit override mechanism moves
  exclusively to editing `infra/terragrunt/{nonprod,prod}/environment.yaml`.

## Repository Standards

This spec follows the project's established standards:

- **Conventional Commits** — every commit in the implementation PRs
  must use a valid type prefix (`fix:`, `chore:`, `ci:`, `refactor:`,
  `feat:` where applicable). CI and commitlint will reject invalid
  formats.
- **Never commit directly to `main`** — all changes land on feature
  branches (`fix/ci-*`, `chore/ci-*`, etc.) via pull request.
- **Pinned action SHAs** — new action references (e.g.
  `gruntwork-io/terragrunt-action`,
  `actions/create-github-app-token`) follow the existing convention
  of pinning to a commit SHA with a `# vX.Y.Z` comment for
  readability, matching how `actions/checkout`, `actions/setup-node`,
  and `mikefarah/yq` are pinned today.
- **Secrets handling** — no PATs, tokens, private keys, or Azure
  identifiers beyond what is already in the repo shall be committed.
  The GitHub App private key lives in repo secrets only. The tenant
  ID moves from inline strings to `vars.AZURE_TENANT_ID`, which is
  not a secret but also is no longer duplicated.
- **Workflow YAML style** — kebab-case filenames, lowercase job keys,
  `id-token: write` only where OIDC is actually used. Matches existing
  `pull-request.yaml` and `apply-prod.yml` conventions.

## Technical Considerations

- **`gruntwork-io/terragrunt-action` minimum Terragrunt version** is
  `0.77.22`. The current pin is `0.72.0`, so migrating to the action
  forces a Terragrunt bump. The repo's Terragrunt configs
  (`infra/terragrunt/**/*.hcl`) must continue to work under the
  bumped version; if any breaking syntax changes exist between
  `0.72.x` and the target, they must be resolved as part of Unit 2.
- **`mise.toml` scope** — `mise.toml` pins OpenTofu and Terragrunt
  only. Node is installed via `actions/setup-node` with a hardcoded
  `node-version: 24`, not via mise. This is a deliberate narrow
  scope: `actions/setup-node` does not natively read `mise.toml`
  (supported formats are `.nvmrc`, `.node-version`, `package.json`,
  and `.tool-versions`), and unifying Node under mise would require
  either replacing `actions/setup-node` with `jdx/mise-action` or
  introducing a second tool-version file. Both options widen the
  spec beyond CI/CD hardening. A future dev-environment parity spec
  can revisit this if contributors want unified tool management
  across CI and local dev.
- **GitHub App token minting** — `actions/create-github-app-token`
  expects an App ID and a PEM-formatted private key. The App must be
  installed on the `liatrio/gratibot` repo before the workflow can
  mint tokens. This is an out-of-repo prerequisite.
- **Image promotion via `docker buildx imagetools create`** operates
  on manifests at the registry, requires only a valid registry login,
  and does not download layers. The GHCR login step in the promote
  job still requires `packages: write` at the workflow or job level,
  which already exists in `apply-prod.yml`.
- **Concurrency semantics** — `cancel-in-progress: true` is correct
  for CI validation and PR validation workflows (the intent is to
  discard superseded work). It is incorrect for deploy workflows,
  which should queue applies to avoid partial/overlapping
  infrastructure updates. Existing `tf-nonprod` and `tf-prod` groups
  continue without `cancel-in-progress`.
- **CodeQL matrix cleanup** — the `pathsIgnore` key was never a valid
  matrix dimension; it is simply dropped. Path filtering, if ever
  needed, belongs in a CodeQL config file rather than a matrix.
- **No external standards research was required beyond the action
  and tooling choices already named in the input.** The input
  explicitly names `gruntwork-io/terragrunt-action`, `mise.toml`,
  `actions/create-github-app-token`, and `docker buildx imagetools
  create`; all are current, standard approaches at the time of
  writing.

## Security Considerations

- **PAT revocation (Unit 5)** — the old `GRATIBOT_RELEASE_TOKEN` PAT
  must be revoked in the owning user's GitHub account and removed
  from repo secrets after the App-token path is proven working.
  Leaving both in place indefinitely defeats the purpose of the
  migration.
- **GitHub App private key storage** — the App's private key is
  stored in repo secrets only (never committed, never logged). The
  App ID may live in repo variables.
- **`AZURE_TENANT_ID` as a variable, not a secret** — the tenant ID
  is not a secret (it is discoverable from Azure AD metadata), so
  storing it as a repo variable is appropriate. The migration only
  de-duplicates it.
- **Proof artifacts must not include tokens or private keys** — the
  CI-run URLs and diffs captured in this spec's proofs folder must
  not embed the minted App token, the PAT being revoked, or the
  GitHub App private key. Screenshots of settings pages showing
  secret presence/absence are acceptable; screenshots showing secret
  values are not.
- **OIDC scoping of the `plan` environment in `apply-prod.yml`** is
  preserved by this spec. The clarifying comment added in Unit 1
  makes it explicit that the environment is load-bearing for access
  control, not cosmetic.

## Success Metrics

1. **Zero latent bugs remaining in the named workflows**: the dead
   `if:` gates, the typo'd `GRATIBOT_LIMIT`, and the
   `needs.build.outputs.docker_tag` mismatch are all removed, verified
   by diff review and successful workflow runs.
2. **Single-person dependencies eliminated from the release path**:
   the `GRATIBOT_RELEASE_TOKEN` PAT and the
   `Pactionly`/`gesparza3` actor allow-list are both gone from
   `.github/workflows/`, verified by `grep`-style review of the
   workflow files.
3. **One CI workflow replaces three**: `test.yaml`, `lint.yaml`, and
   `codeql-analysis.yml` are deleted and `ci.yaml` runs all three
   jobs successfully on PRs and on push to `main`.
4. **Prod image == nonprod image, by digest**: for at least one full
   release cycle after the promote change, the nonprod `sha_short`
   tag and the release tag resolve to the same GHCR image digest.
5. **Four Backstage files deleted, no docs regression**: `docs/`
   otherwise intact and all `CLAUDE.md` cross-links resolve.

## Open Questions

No open questions at this time. The three questions raised during
initial drafting were resolved in-spec:

- `mise.toml` is scoped to OpenTofu and Terragrunt only; Node stays
  on `actions/setup-node`. See Technical Considerations.
- The GitHub App permission set is pinned to `contents: write`,
  `issues: write`, `pull-requests: write`. See Unit 5.
- The Terragrunt `0.72.0` → `0.77.22` bump requires no breaking HCL
  changes; deprecated CLI flags and the unlabeled `include` block
  are cleaned up as part of Unit 2.

## Out-of-Repo Prerequisites

These steps occur outside this repository and must be completed in
coordination with the implementation PRs. They are listed here for
traceability and will be surfaced again in the task list.

> **Human responsibility.** Every item in this section must be performed
> by the person running this workflow (or another appropriately
> privileged human operator), not by the implementation agent. The
> agent's scope is limited to changes inside this repository. Any task
> in the downstream task list that maps to one of these prerequisites
> must be marked as a human gate and not auto-executed.

1. **Create and install a GitHub App at the org level** (required by
   Unit 5). Record the App ID as a repo variable, store the private
   key as a repo secret, and install the App on `liatrio/gratibot`.
   Done by someone with org admin access.
2. **Add `AZURE_TENANT_ID` as a repo variable** with the value
   `1b4a4fed-fed8-4823-a8a0-3d5cea83d122` (required by Unit 1).
3. **Update branch protection required-check names** after Unit 3
   ships: remove the old `test`, `lint`, and `CodeQL / Analyze`
   required checks; add `CI / lint`, `CI / test`, `CI / codeql`.
4. **Revoke `GRATIBOT_RELEASE_TOKEN`** after Unit 5 has been proven
   in a release run: remove the repo secret and revoke the PAT in its
   owner's GitHub account.

## Key Ordering and Dependencies

1. **Unit 1** (deploy-workflow correctness fixes) should land first
   so that Units 2 and 4 build on a correct baseline and do not touch
   the same env blocks twice.
2. **Unit 2** (mise + terragrunt-action migration) should land before
   or together with **Unit 3** (CI consolidation) so that all
   workflows use the same tool-install mechanism from the moment
   consolidation ships.
3. **Unit 4** (promote-don't-rebuild) should land with or after
   **Unit 1**, because the Azure tenant var migration and the
   promote change both touch `apply-prod.yml`'s env blocks.
4. **Unit 5** (GitHub App token migration) is independent of the
   other units but has an org-level prerequisite (creating the App).
   Schedule the prerequisite before the PR.
5. **Unit 6** (Backstage decommission) is independent of everything
   else and can land at any time.
6. After **Unit 3** merges, branch protection required-check names
   must be updated (out-of-repo; see Prerequisites).
