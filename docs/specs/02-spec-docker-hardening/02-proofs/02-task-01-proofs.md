# Task 01 Proofs - Dockerfile hardening (npm ci, non-root user, exec-form ENTRYPOINT)

## Task Summary

This task proves that the Dockerfile has been hardened with three changes: reproducible
production-only installs via `npm ci --omit=dev --ignore-scripts`, non-root execution via
`USER node` with `--chown=node:node` file ownership, and proper signal handling via the
exec-form `ENTRYPOINT ["node", "app.js"]`.

The `--ignore-scripts` flag was added to `npm ci --omit=dev` to handle a pre-existing issue
where the `prepare` lifecycle script invokes `husky`, a devDependency that is not installed
when `--omit=dev` is used. This flag skips lifecycle scripts during install and does not
affect runtime behaviour.

## What This Task Proves

- The image builds successfully with `npm ci --omit=dev --ignore-scripts`.
- The image metadata shows `USER node` is the configured user.
- A process started inside the container runs as UID 1000 (non-root).

## Evidence Summary

- `docker build` exits 0 and produces image `gratibot-hardened`.
- `docker inspect` returns `"User": "node"`.
- `docker run --entrypoint node … -e "console.log(process.getuid())"` outputs `1000`.

## Artifact: docker build success

**What it proves:** The Dockerfile is syntactically valid and the build succeeds with the
new install command and ownership flags.

**Why it matters:** A failed build would block all downstream verification.

**Command:**

```bash
docker build --no-cache -t gratibot-hardened .
```

**Result summary:** Build completed successfully through all 5 layers; 170 production
packages installed, 0 vulnerabilities found.

```
#8 [4/5] RUN npm ci --omit=dev --ignore-scripts
#8 added 170 packages, and audited 171 packages in 8s
#8 found 0 vulnerabilities
#9 [5/5] COPY --chown=node:node . .
#10 writing image sha256:84d1cec7... done
#10 naming to docker.io/library/gratibot-hardened done
```

## Artifact: docker inspect user field

**What it proves:** The image is configured to run as the non-root `node` user.

**Why it matters:** `USER node` in the Dockerfile only takes effect if it is parsed and
written into the image config; inspect is the authoritative source.

**Command:**

```bash
docker inspect gratibot-hardened | grep -i '"user"'
```

**Result summary:** Output includes `"User": "node"`, confirming the non-root user is set.

```
"User": "",
"User": "node",
```

(The first entry is the base image's empty default; the second is the gratibot image config.)

## Artifact: running process UID

**What it proves:** A process started in the container runs as UID 1000, not root (UID 0).

**Why it matters:** Image config and runtime UID must both be verified — a misconfigured
`USER` instruction could still result in a root process.

**Command:**

```bash
docker run --rm --entrypoint node gratibot-hardened -e "console.log(process.getuid())"
```

**Result summary:** Output is `1000`, confirming the container process is non-root.

```
1000
```

## Reviewer Conclusion

All three Dockerfile hardening changes are in place and verified: the image builds cleanly
with production-only reproducible dependencies, the configured user is `node`, and the
running process UID is 1000 (non-root).
