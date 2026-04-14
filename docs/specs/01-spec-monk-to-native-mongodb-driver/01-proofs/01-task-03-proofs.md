# Task 03 Proofs - App startup wired to MongoClient, health check database ping, CosmosDB version pinned

## Task Summary

This task added explicit connection management to `app.js` (explicit `client.connect()` before
features load, startup error handling with `process.exit(1)`), implemented the `/health`
database ping (resolving the `// TODO`), removed the vestigial port argument from
`app.start()`, and pinned `mongo_server_version = "4.2"` in the CosmosDB Terraform resource.

## What This Task Proves

- `app.js` imports `client` from `database/db.js` and calls `client.connect()` before startup.
- The startup IIFE is wrapped in `try/catch` with `process.exit(1)` on failure.
- `app.start()` no longer passes the port argument (socket mode doesn't bind HTTP).
- `/health` now pings the database and includes `"database": "OK"` or an error string.
- `infra/terraform/cosmosdb.tf` contains `mongo_server_version = "4.2"`.
- All 117 tests pass after these changes.

## Evidence Summary

- `npm test` exits 0, 117 passing — startup refactor did not break any tests.
- `grep` confirms `mongo_server_version` is present in the Terraform file.
- The updated `app.js` IIFE and health handler are shown as code evidence below.

---

## Artifact: Test suite — 117 passing after startup changes

**What it proves:** The `app.js` refactor did not break any existing tests.

**Why it matters:** `app.js` is the entry point; if the import or startup sequence broke
module loading, tests would fail at require time.

**Command:**

```bash
npm test
```

**Result summary:** 117 tests passing in 69ms. 0 failures.

```
117 passing (69ms)
```

---

## Artifact: cosmosdb.tf contains mongo_server_version = "4.2"

**What it proves:** The MongoDB API version is pinned in source control.

**Why it matters:** This is the Terraform-level proof that the spec requirement is met.
A human must approve the GitHub Actions workflow before this affects real Azure resources.

**Command:**

```bash
grep "mongo_server_version" infra/terraform/cosmosdb.tf
```

**Result:**

```
  mongo_server_version       = "4.2"
```

---

## Artifact: Updated app.js startup IIFE

**What it proves:** `client.connect()` is called before features load and `app.start()`,
the IIFE is wrapped in try/catch with `process.exit(1)`, and the port argument is removed.

```javascript
(async () => {
  try {
    await client.connect();

    var normalizedPath = require("path").join(__dirname, "features");
    require("fs")
      .readdirSync(normalizedPath)
      .forEach(function (file) {
        require("./features/" + file)(app);
      });

    await app.start();
    webserver.listen(process.env.PORT || 3000);

    winston.info("⚡️ Bolt app is running!");
  } catch (e) {
    winston.error("Startup failed", { error: e.message });
    process.exit(1);
  }
})();
```

---

## Artifact: /health database check implementation

**What it proves:** The `// TODO` placeholder is replaced with a real `ping` command against
the connected MongoClient. The health endpoint now includes `"database": "OK"` when reachable
or an error string when not.

```javascript
// Check Database Connection
try {
  await client.db().command({ ping: 1 });
  status_checks.database = "OK";
} catch (e) {
  status_checks.database = e.message;
}
```

---

## Note on Sub-task 3.8 (CI terraform plan)

Sub-task 3.8 requires opening a PR and observing the GitHub Actions terraform plan step
report 0 resources to add, change, or destroy. This is a CI/human verification step
performed after this commit is pushed. The `mongo_server_version = "4.2"` addition is
expected to be a no-op on the existing CosmosDB account because the version is already
configured on the live resource; the Terraform state will reflect this after `plan`.

---

## Reviewer Conclusion

App startup now explicitly connects to MongoDB before loading features, shuts down cleanly
on connection failure, and the `/health` endpoint reports real database status. The CosmosDB
API version is pinned in Terraform. All 117 tests pass.
