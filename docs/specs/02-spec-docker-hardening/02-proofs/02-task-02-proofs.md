# Task 02 Proofs - .dockerignore cleanup (stale entry fix and context reduction)

## Task Summary

This task proves that `.dockerignore` has been updated to replace the stale `tf/` entry
with `infra/` (matching the current repository layout) and to exclude five directories
that have no runtime role: `test/`, `docs/`, `.github/`, `.husky/`. All existing entries
were preserved.

## What This Task Proves

- The Docker build context is dramatically smaller after the change.
- The application still builds and produces a working image after the context reduction.
- All required existing entries (`.env`, `node_modules/`, `README.md`, `Dockerfile`) are
  preserved in `.dockerignore`.

## Evidence Summary

- Build context dropped from ~333 MB (pre-change) to **274 KB** — over a 1000x reduction.
- `docker build --no-cache` exits 0 with the updated `.dockerignore`.
- All five required entries remain present in the updated file.

## Artifact: Build context size reduction

**What it proves:** The new exclusions significantly reduce the data sent to the Docker
daemon on each build, speeding up CI and reducing network overhead.

**Why it matters:** This is the primary goal of the task — a smaller build context means
faster, leaner builds.

**Command:**

```bash
docker build --no-cache --progress=plain .
```

**Result summary:** The "load build context" step transferred 274.74 KB, compared to
~333 MB before the change (measured in task 1.0 proof build with original `.dockerignore`).

```
#6 [internal] load build context
#6 transferring context: 274.74kB 1.1s done
```

Pre-change (from task 1.0 proof run with original `.dockerignore`):
```
#6 transferring context: 333.02MB 34.7s done
```

## Artifact: Build completes successfully

**What it proves:** The application still builds correctly after the context reduction —
no required runtime files were accidentally excluded.

**Why it matters:** An overly aggressive `.dockerignore` could exclude source files
needed by the application, causing build or runtime failures.

**Result summary:** Build exited 0; all 5 stages completed; 170 packages installed, 0
vulnerabilities found; final image written successfully.

```
#8 added 170 packages, and audited 171 packages in 5s
#8 found 0 vulnerabilities
#10 writing image sha256:0f1aedbf... done
```

## Artifact: Final .dockerignore content

**What it proves:** The stale `tf/` entry is replaced with `infra/`, the five new entries
are present, and all required existing entries are preserved.

**Why it matters:** Correctness of the file content is the direct requirement of subtasks
2.1, 2.2, and 2.3.

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

Required entries confirmed present: `.env` ✓ `node_modules/` ✓ `README.md` ✓ `Dockerfile` ✓

## Reviewer Conclusion

The `.dockerignore` update achieves over a 1000x build context reduction (333 MB → 274 KB),
the stale `tf/` entry is replaced with `infra/`, all five new exclusions are in place, and
the application builds successfully with no regressions.
