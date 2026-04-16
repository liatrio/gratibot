# 02-validation-docker-hardening.md

## 1. Executive Summary

- **Overall:** PASS — no gates tripped
- **Implementation Ready:** **Yes** — all functional requirements are verified with working
  proof artifacts; the only open item is a missing PR URL in the Task 4.0 proof doc.
- **Key metrics:**
  - Requirements Verified: 10/10 (100%)
  - Proof Artifacts Functional: 9/10 (90% — PR URL placeholder not resolved)
  - Files Changed: 8 total (3 core, 5 supporting) — all mapped to requirements or tasks

---

## 2. Coverage Matrix

### Functional Requirements

| Requirement | Status | Evidence |
|---|---|---|
| Dockerfile: use `npm ci --omit=dev` | Verified | `Dockerfile:5` — `RUN npm ci --omit=dev --ignore-scripts`; `--ignore-scripts` is a documented deviation (husky devDependency); proof: `02-task-01-proofs.md` build output shows 170 packages installed |
| Dockerfile: `ENTRYPOINT ["node", "app.js"]` (exec form, Node.js as PID 1) | Verified | `Dockerfile:11`; proof: `02-task-01-proofs.md` docker inspect confirms `"User": "node"` |
| Dockerfile: `USER node` before ENTRYPOINT | Verified | `Dockerfile:10`; proof: `02-task-01-proofs.md` — `docker run` UID check returns `1000` |
| Dockerfile: both COPY with `--chown=node:node` | Verified | `Dockerfile:4` and `Dockerfile:7` — both COPY instructions carry the flag |
| `.dockerignore`: exclude `test/`, `docs/`, `infra/`, `.github/`, `.husky/` | Verified | `.dockerignore` lines 1, 6–9; `02-task-02-proofs.md` final file content listing |
| `.dockerignore`: replace `tf/` with `infra/` | Verified | `.dockerignore:1` — only `infra/` present, `tf/` absent; pre-change context ~333 MB → 274 KB |
| `.dockerignore`: preserve `.env`, `node_modules/`, `README.md`, `Dockerfile` | Verified | `.dockerignore:2–5`; `02-task-02-proofs.md` required entries confirmed ✓ |
| `docker-compose.yaml`: remove deprecated `version: "2.2"` | Verified | `docker-compose.yaml` — no `version` field; `02-task-03-proofs.md` — `docker compose config` output shows no top-level `version` |
| `docker-compose.yaml`: remove `entrypoint: npm start` override | Verified | `docker-compose.yaml` — no `entrypoint` key on `gratibot` service; `02-task-03-proofs.md` `docker compose config` output confirms absent |
| `docker-compose.yaml`: all other definitions preserved | Verified | `docker-compose.yaml` — 13 env vars, `ports`, `depends_on`, `build`, `container_name`, and `mongodb` service all present; `02-task-03-proofs.md` config output annotations |

### Repository Standards

| Standard | Status | Evidence & Notes |
|---|---|---|
| Conventional Commits (`chore:` type) | Verified | All 4 commits use `chore:` prefix: `d2c9f50`, `cdeb7cc`, `15b832f`, `f304a64`; commit messages match the conventional commits spec |
| Feature branch (not direct push to `main`) | Verified | Branch `chore/docker-hardening` — 4 commits ahead of `main`; `git diff main...chore/docker-hardening` confirms isolation |
| No tests required | Verified | Spec §Repository Standards explicitly exempts this change; no `service/` or `features/` files were touched |
| `npm run lint` passes (pre-commit gate) | Verified | `02-task-04-proofs.md` — clean exit 0, no errors; consistent with Husky pre-commit hook running on each commit |
| No secrets or credentials committed | Verified | `02-task-03-proofs.md` — Slack tokens redacted as `[REDACTED]`; no credentials in proof artifacts or changed core files |

### Proof Artifacts

| Task | Proof Artifact | Status | Verification Result |
|---|---|---|---|
| T1 — Dockerfile hardening | `docker build --no-cache -t gratibot-hardened .` | Verified | Build exits 0; 170 packages installed; 0 vulnerabilities |
| T1 — Dockerfile hardening | `docker inspect gratibot-hardened \| grep -i '"user"'` | Verified | Output includes `"User": "node"` |
| T1 — Dockerfile hardening | `docker run --rm --entrypoint node gratibot-hardened -e "console.log(process.getuid())"` | Verified | Output `1000` — non-root confirmed |
| T2 — `.dockerignore` cleanup | `docker build --no-cache --progress=plain .` | Verified | Build exits 0; context size 274.74 KB (vs ~333 MB pre-change) |
| T2 — `.dockerignore` cleanup | Final `.dockerignore` content listing | Verified | File content matches; all required entries present ✓ |
| T3 — `docker-compose.yaml` cleanup | `docker compose config` | Verified | Exit 0, no warnings; no `version` field, no `entrypoint` key on gratibot service |
| T4 — Branch, lint, PR | `npm run lint` | Verified | Exit 0, no output — clean |
| T4 — Branch, lint, PR | `git log --oneline chore/docker-hardening ^main` | Verified | 3 implementation commits with `chore:` type and spec task references |
| T4 — Branch, lint, PR | Pull request URL | **Incomplete** | Proof doc placeholder: "see below — populated after push" — no URL provided |

---

## 3. Validation Issues

| Severity | Issue | Impact | Recommendation |
|---|---|---|---|
| MEDIUM | **PR URL not populated in proof artifact.** `02-task-04-proofs.md` contains the placeholder `"PR URL: [see below — populated after push]"` with no actual GitHub URL. Evidence: file read of `docs/specs/02-spec-docker-hardening/02-proofs/02-task-04-proofs.md` line 68. | Traceability gap — cannot verify CI checks (lint + test) passed on the PR from the proof alone | Update `02-task-04-proofs.md` with the actual PR URL and CI status (green checks) before or at merge time |
| LOW | **Undocumented flag addition: `--ignore-scripts`.** The spec requires `npm ci --omit=dev`; the implementation uses `npm ci --omit=dev --ignore-scripts`. The proof document (`02-task-01-proofs.md`) explains the reason (husky `prepare` script fails without devDependencies), but the task list and spec are not updated to reflect this decision. | Minor spec/implementation drift; no functional impact — the build succeeds and intent is met | Optionally note the `--ignore-scripts` addition in the task list notes or spec Technical Considerations section so the rationale is permanently traceable in the spec itself |

---

## 4. Evidence Appendix

### Git Commits Analyzed

```
f304a64  chore: add task 4.0 proof artifacts and mark all tasks complete
         Changed: 02-task-04-proofs.md, 02-tasks-docker-hardening.md

15b832f  chore: remove deprecated version field and redundant entrypoint from docker-compose.yaml
         Changed: docker-compose.yaml, 02-task-03-proofs.md, 02-tasks-docker-hardening.md

cdeb7cc  chore: update .dockerignore to fix stale tf/ entry and reduce build context
         Changed: .dockerignore, 02-task-02-proofs.md, 02-tasks-docker-hardening.md

d2c9f50  chore: harden Dockerfile with npm ci, non-root user, and exec-form ENTRYPOINT
         Changed: Dockerfile, 02-task-01-proofs.md, 02-tasks-docker-hardening.md
```

### Files Changed on Branch vs. Main

```
.dockerignore                                                  (core — Relevant Files ✓)
Dockerfile                                                     (core — Relevant Files ✓)
docker-compose.yaml                                            (core — Relevant Files ✓)
docs/specs/02-spec-docker-hardening/02-proofs/02-task-01-proofs.md  (supporting — proof artifact)
docs/specs/02-spec-docker-hardening/02-proofs/02-task-02-proofs.md  (supporting — proof artifact)
docs/specs/02-spec-docker-hardening/02-proofs/02-task-03-proofs.md  (supporting — proof artifact)
docs/specs/02-spec-docker-hardening/02-proofs/02-task-04-proofs.md  (supporting — proof artifact)
docs/specs/02-spec-docker-hardening/02-tasks-docker-hardening.md    (supporting — task tracking)
```

All 3 core files are in the Relevant Files list. All 5 supporting files are linked to core
changes through the task structure. No unmapped out-of-scope changes.

### Dockerfile (final state)

```dockerfile
FROM node:24-alpine
WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --chown=node:node . .

EXPOSE 3000
USER node
ENTRYPOINT ["node", "app.js"]
```

### .dockerignore (final state)

```
infra/
.env
node_modules/
README.md
Dockerfile
test/
docs/
.github/
.husky/
```

### docker-compose.yaml (final state — key structural points)

- No top-level `version:` field
- No `entrypoint:` on the `gratibot` service
- 14 environment variables, `ports: 3000:3000`, `depends_on: mongodb`, `build: .` all intact
- `mongodb` service (`mongo:4.2`, `ports: 27017:27017`) unchanged

---

**Validation Completed:** 2026-04-16  
**Validation Performed By:** Claude Sonnet 4.6
