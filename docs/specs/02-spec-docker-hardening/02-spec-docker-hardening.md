# 02-spec-docker-hardening.md

## Introduction/Overview

The Gratibot Dockerfile, `.dockerignore`, and `docker-compose.yaml` contain several issues
identified during a targeted review: an unreproducible install command, broken signal
handling, a root-user security gap, an oversized build context, a stale ignore entry, and
two Compose file hygiene problems. This spec covers all seven fixes as a single coherent
hardening pass so they ship together rather than as unrelated one-off commits.

## Goals

- Replace `npm install` with `npm ci --omit=dev` so production image builds are
  reproducible and contain only runtime dependencies.
- Ensure Node.js runs as PID 1 so SIGTERM is forwarded correctly and container shutdown
  is graceful.
- Eliminate the root-user security risk by running the application as the built-in
  non-root `node` user.
- Reduce the Docker build context by excluding non-runtime directories from
  `.dockerignore`.
- Remove stale and redundant configuration from `.dockerignore` and `docker-compose.yaml`.

## User Stories

**As a platform engineer**, I want the production container image to use a locked,
reproducible dependency install so that image builds are deterministic across CI runs and
developer machines.

**As a platform engineer**, I want the container to receive and handle SIGTERM correctly
so that rolling deployments and container stop operations complete gracefully without
requiring Docker's force-kill timeout.

**As a security reviewer**, I want the bot process to run as a non-root user so that a
compromised process cannot escalate privileges or write to the container filesystem.

**As a developer**, I want the Docker build context to exclude test files, docs, and
infrastructure code so that `docker build` is fast and the final image contains only what
is needed to run the bot.

## Demoable Units of Work

### Unit 1: Dockerfile Hardening

**Purpose:** Fix all three Dockerfile issues (reproducible install, signal handling,
non-root user) so the production image is secure, deterministic, and shutdown-safe.

**Functional Requirements:**
- The Dockerfile shall use `npm ci --omit=dev` instead of `npm install`.
- The Dockerfile shall use `ENTRYPOINT ["node", "app.js"]` so Node.js is PID 1.
- The Dockerfile shall switch to the built-in `node` user (shipped in all official
  `node:*` images) before the `ENTRYPOINT` instruction using `USER node`.
- Both `COPY` instructions shall use `--chown=node:node` so files are owned by the `node`
  user at copy time, avoiding an extra `chown` layer over `node_modules`.

**Proof Artifacts:**
- `docker build .` completes without errors and produces an image.
- `docker inspect <image> | grep -i user` shows `node` as the configured user.
- `docker run --rm <image> node -e "console.log(process.getuid())"` returns a non-zero UID.

### Unit 2: `.dockerignore` Cleanup

**Purpose:** Reduce the build context sent to the Docker daemon by excluding directories
and files that have no role in running the bot, and remove a stale path entry.

**Functional Requirements:**
- The `.dockerignore` shall exclude `test/`, `docs/`, `infra/`, `.github/`, and `.husky/`
  so they are not sent as part of the build context.
- The stale entry `tf/` shall be replaced with `infra/` to match the current repository
  layout.
- All other existing exclusions (`.env`, `node_modules/`, etc.) shall be preserved.

**Proof Artifacts:**
- `docker build --no-cache .` completes successfully, confirming the application still
  runs after the context reduction.
- `docker build` output shows a reduced "sending build context" size compared to before
  the change (observable in `--progress=plain` output).

### Unit 3: `docker-compose.yaml` Cleanup

**Purpose:** Remove the deprecated `version` field and the redundant `entrypoint`
override so the Compose file is current and consistent with the Dockerfile.

**Functional Requirements:**
- The `version: "2.2"` field shall be removed from `docker-compose.yaml`.
- The `entrypoint: npm start` field on the `gratibot` service shall be removed, so the
  Dockerfile `ENTRYPOINT` is the single source of truth.
- All other service definitions, environment variable pass-throughs, and port mappings
  shall remain unchanged.

**Proof Artifacts:**
- `docker compose config` (Compose v2) parses the file without warnings.
- `docker compose up --build` starts both the `gratibot` and `mongodb` services
  successfully (requires valid `.env` with Slack tokens; can be verified structurally
  without tokens by confirming no Compose parse errors).

## Non-Goals (Out of Scope)

1. **MongoDB version upgrade**: Upgrading `mongo:4.2` to a newer version in
   `docker-compose.yaml` and the corresponding CosmosDB `server_version` in Terraform is
   intentionally excluded — it requires a paired infra change and separate validation.
2. **Multi-stage builds**: No multi-stage Dockerfile pattern is introduced; the single-
   stage alpine build is sufficient for this codebase's size.
3. **Health checks in Compose**: Adding a `healthcheck` and `condition: service_healthy`
   to the `depends_on` block is out of scope here and should be addressed alongside the
   MongoDB version upgrade (issue #8).
4. **CI/CD pipeline changes**: No changes to GitHub Actions workflows are required.
5. **Production infrastructure changes**: No changes to `infra/` Terraform or Terragrunt
   files are included.

## Design Considerations

No UI or UX requirements. These are infrastructure file changes only.

## Repository Standards

- Commits must follow Conventional Commits format; the appropriate type for these changes
  is `chore:` (infrastructure/tooling improvement, no user-facing behavior change).
- Changes must be made on a feature branch — direct pushes to `main` are rejected.
- No tests are required for these changes (no `service/` or `features/` logic is modified).
- Run `npm run lint` before committing to satisfy the pre-commit hook.

## Technical Considerations

**`npm ci --omit=dev`:** `npm ci` installs exactly what is in `package-lock.json` and
fails if the lockfile is out of sync with `package.json`, making builds reproducible.
`--omit=dev` excludes all `devDependencies` (Mocha, Sinon, ESLint, Husky, etc.), reducing
image layer size. This is the current Node.js Docker best practice per the official
Node.js Docker guidance.

**`--ignore-scripts` flag:** The implementation uses `npm ci --omit=dev --ignore-scripts`
rather than the bare `npm ci --omit=dev` called out in the spec. The `prepare` lifecycle
script in `package.json` invokes `husky`, which is a devDependency absent when `--omit=dev`
is active. Without `--ignore-scripts`, `npm ci` fails at the post-install lifecycle step.
The flag skips all lifecycle scripts during install and has no effect on runtime behaviour —
no scripts run at container startup.

**PID 1 / signal handling:** When `npm start` is the ENTRYPOINT, `npm` is PID 1 and
Node.js is a child process. npm does not forward SIGTERM to its children, so `docker stop`
waits the full 10-second grace period before force-killing the container. Using
`ENTRYPOINT ["node", "app.js"]` (exec form, not shell form) makes Node.js PID 1 and
ensures SIGTERM is delivered directly.

**Non-root user:** The official `node:24-alpine` base image ships with a pre-created
`node` user (UID 1000). Using `USER node` before `ENTRYPOINT` is the simplest approach
and avoids the need to create a custom user. File ownership must be considered: if `COPY`
runs before the `USER` instruction, files are owned by root. The `COPY --chown=node:node`
flag or a `chown` instruction should be used to grant the `node` user read access to
`/app`.

**`.dockerignore` entries to add:** Based on the current repository layout, the following
directories serve no runtime purpose and should be excluded: `test/`, `docs/`, `infra/`,
`.github/`, `.husky/`. Existing entries for `node_modules/` and `.env` must be preserved.

**Compose `version` field:** Docker Compose v2 (the current CLI) uses the Compose
Specification and ignores the top-level `version` key entirely. Removing it produces no
behavioral change but eliminates deprecation warnings on newer Compose CLI versions.

## Security Considerations

- Running as a non-root user (Unit 1) is the primary security improvement: a compromised
  Node.js process cannot write outside `/app` or escalate to root within the container.
- No secrets, tokens, or credentials are touched by this change.
- The `.dockerignore` additions (Unit 2) prevent `.env` from being accidentally copied
  into the image during a build — `.env` is already excluded and must remain so.
- No new environment variables or credentials are introduced.

## Success Metrics

1. **Reproducibility**: `docker build` produces the same image hash on two consecutive
   clean builds from the same commit.
2. **Non-root confirmed**: `docker inspect` and a runtime UID check confirm the process
   runs as UID 1000 (`node`), not UID 0.
3. **Graceful shutdown**: `docker stop <container>` exits within 2 seconds (not the
   10-second timeout), confirming SIGTERM is handled by Node.js directly.
4. **Compose clean parse**: `docker compose config` produces no warnings or errors.

## Open Questions

No open questions at this time.

**Resolved:** Use `COPY --chown=node:node` on both `COPY` instructions rather than a
`RUN chown -R node:node /app`. The `--chown` flag sets ownership at copy time with no
extra layer and no re-walk of `node_modules`, whereas a `chown -R` after `npm ci` would
create a large layer duplicating ownership metadata for every file in `node_modules`.
