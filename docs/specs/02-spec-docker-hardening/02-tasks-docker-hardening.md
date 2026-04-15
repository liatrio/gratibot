# 02-tasks-docker-hardening.md

## Relevant Files

| File | Why It Is Relevant |
|---|---|
| `Dockerfile` | Primary target — receives all three hardening changes (install command, entrypoint, non-root user). |
| `.dockerignore` | Receives stale entry fix (`tf/` → `infra/`) and five new directory exclusions. |
| `docker-compose.yaml` | Receives removal of the deprecated `version` field and the redundant `entrypoint` override. |

### Notes

- No test files are required — this change touches only infrastructure files (`Dockerfile`,
  `.dockerignore`, `docker-compose.yaml`). No `service/` or `features/` logic is modified.
- Run `npm run lint` before committing to satisfy the Husky pre-commit hook.
- Use `chore:` as the conventional commit type — these are tooling/infrastructure improvements
  with no user-facing behavior change.
- All changes must be made on a feature branch; direct pushes to `main` are rejected.

## Tasks

### [x] 1.0 Harden the Dockerfile

Fix all three Dockerfile issues: replace `npm install` with `npm ci --omit=dev` for
reproducible builds, switch to `ENTRYPOINT ["node", "app.js"]` (exec form) so Node.js
is PID 1 and receives SIGTERM directly, add `USER node` before `ENTRYPOINT`, and apply
`--chown=node:node` to both `COPY` instructions so the `node` user owns all files.

#### 1.0 Proof Artifact(s)

- CLI: `docker build .` completes without errors and produces an image — demonstrates the
  Dockerfile is syntactically valid and the build succeeds with the new install command.
- CLI: `docker inspect <image> | grep -i user` returns `"node"` — demonstrates the image
  is configured to run as the non-root `node` user.
- CLI: `docker run --rm <image> node -e "console.log(process.getuid())"` returns a
  non-zero UID (1000) — demonstrates the running process is not root.

#### 1.0 Tasks

- [x] 1.1 In `Dockerfile`, change `RUN npm install` to `RUN npm ci --omit=dev`.
- [x] 1.2 In `Dockerfile`, add `--chown=node:node` to the first `COPY` instruction so it
  reads `COPY --chown=node:node package*.json ./`.
- [x] 1.3 In `Dockerfile`, add `--chown=node:node` to the second `COPY` instruction so it
  reads `COPY --chown=node:node . .`.
- [x] 1.4 In `Dockerfile`, add `USER node` on a new line immediately before the `ENTRYPOINT`
  instruction.
- [x] 1.5 In `Dockerfile`, replace `ENTRYPOINT ["npm", "start"]` with
  `ENTRYPOINT ["node", "app.js"]`.
- [x] 1.6 Run `docker build -t gratibot-hardened .` and confirm the command completes
  without errors.
- [x] 1.7 Run `docker inspect gratibot-hardened | grep -i user` and confirm the output
  includes `"node"`.
- [x] 1.8 Run `docker run --rm gratibot-hardened node -e "console.log(process.getuid())"` and
  confirm the output is `1000` (non-root).

---

### [x] 2.0 Clean up `.dockerignore`

Reduce the Docker build context by adding the five directories that have no runtime role
(`test/`, `docs/`, `infra/`, `.github/`, `.husky/`) and replace the stale `tf/` entry
with `infra/` to match the current repository layout. All existing entries (`.env`,
`node_modules/`, etc.) must be preserved.

#### 2.0 Proof Artifact(s)

- CLI: `docker build --no-cache --progress=plain .` completes successfully — demonstrates
  the application still builds after the context reduction.
- CLI: `docker build --progress=plain .` output shows a reduced "sending build context to
  Docker daemon" size compared to before the change — demonstrates the context is smaller.

#### 2.0 Tasks

- [x] 2.1 In `.dockerignore`, replace the `tf/` line with `infra/` to match the current
  repository directory name.
- [x] 2.2 In `.dockerignore`, add the following entries (one per line) after the existing
  content: `test/`, `docs/`, `.github/`, `.husky/`.
- [x] 2.3 Verify the final `.dockerignore` still contains `.env`, `node_modules/`,
  `README.md`, and `Dockerfile` — these must not be removed.
- [x] 2.4 Run `docker build --no-cache --progress=plain .` and confirm it completes
  successfully and the "sending build context" size is smaller than before.

---

### [ ] 3.0 Clean up `docker-compose.yaml`

Remove the deprecated top-level `version: "2.2"` field (silences Compose v2 deprecation
warnings) and remove the `entrypoint: npm start` override on the `gratibot` service so
the Dockerfile `ENTRYPOINT` is the single source of truth. All other service definitions,
environment variable pass-throughs, and port mappings must remain unchanged.

#### 3.0 Proof Artifact(s)

- CLI: `docker compose config` parses without warnings or errors — demonstrates the
  Compose file is valid under Compose Specification v2.
- CLI: `docker compose up --build` starts both `gratibot` and `mongodb` services without
  Compose parse errors (structural verification; full bot startup requires valid `.env`).

#### 3.0 Tasks

- [ ] 3.1 In `docker-compose.yaml`, delete the `version: "2.2"` line at the top of the
  file.
- [ ] 3.2 In `docker-compose.yaml`, delete the `entrypoint: npm start` line from the
  `gratibot` service block.
- [ ] 3.3 Verify all other fields in `docker-compose.yaml` are unchanged: `container_name`,
  `depends_on`, `ports`, `build`, `environment` entries, and the `mongodb` service
  definition.
- [ ] 3.4 Run `docker compose config` and confirm the command exits without warnings or
  errors.

---

### [ ] 4.0 Branch, lint check, and open pull request

Create a feature branch, run `npm run lint` to satisfy the Husky pre-commit hook, commit
all three changed files with a `chore:` conventional commit message, and open a pull
request targeting `main`.

#### 4.0 Proof Artifact(s)

- CLI: `npm run lint` exits with code 0 — demonstrates no lint regressions from the
  infrastructure file changes.
- PR URL: GitHub pull request open and CI checks (lint, test) passing — demonstrates the
  change is ready for review.

#### 4.0 Tasks

- [ ] 4.1 Create a new branch from `main`:
  `git checkout -b chore/docker-hardening`.
- [ ] 4.2 Run `npm run lint` and confirm it exits with code 0 before staging any files.
- [ ] 4.3 Stage the three changed files:
  `git add Dockerfile .dockerignore docker-compose.yaml`.
- [ ] 4.4 Commit with a conventional commit message, for example:
  `chore: harden Dockerfile, .dockerignore, and docker-compose.yaml`.
- [ ] 4.5 Push the branch and open a pull request targeting `main`.
- [ ] 4.6 Confirm CI checks (lint and test) pass on the pull request before requesting review.
