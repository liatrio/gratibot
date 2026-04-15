# Task 03 Proofs - docker-compose.yaml cleanup (remove deprecated version and entrypoint override)

## Task Summary

This task proves that `docker-compose.yaml` has been cleaned up by removing the deprecated
`version: "2.2"` field (silencing Compose v2 deprecation warnings) and the redundant
`entrypoint: npm start` override on the `gratibot` service (making the Dockerfile
`ENTRYPOINT` the single source of truth). All other service definitions, environment
variable pass-throughs, port mappings, and the `mongodb` service are unchanged.

## What This Task Proves

- `docker compose config` parses the updated file without warnings or errors.
- The `gratibot` service no longer has an `entrypoint` override.
- The deprecated top-level `version` field is absent.
- All other service configuration is preserved intact.

## Evidence Summary

- `docker compose config` exits 0 with no warnings; the parsed output shows no `version`
  field and no `entrypoint` on the `gratibot` service.
- All environment variables, ports, `depends_on`, `build`, and the `mongodb` service are
  present and correct in the parsed output.

## Artifact: docker compose config output

**What it proves:** The Compose file is valid under Compose Specification v2 and the two
removed fields are confirmed absent in the parsed configuration.

**Why it matters:** `docker compose config` is the authoritative validation of a Compose
file — exit 0 with no warnings confirms both structural validity and spec compliance.

**Command:**

```bash
docker compose config
```

**Result summary:** Command exited 0 with no warnings. The parsed config shows no
`version` field at the top level and no `entrypoint` key on the `gratibot` service. Slack
token values are redacted from this proof artifact.

```yaml
name: gratibot
services:
  gratibot:
    build:
      context: /path/to/gratibot
      dockerfile: Dockerfile
    container_name: gratibot
    depends_on:
      mongodb:
        condition: service_started
    environment:
      APP_TOKEN: [REDACTED]
      BOT_NAME: null
      BOT_USER_OAUTH_ACCESS_TOKEN: [REDACTED]
      EXEMPT_USERS: null
      GOLDEN_RECOGNIZE_CHANNEL: null
      GOLDEN_RECOGNIZE_EMOJI: null
      GOLDEN_RECOGNIZE_HOLDER: null
      GRATIBOT_LIMIT: null
      LOG_LEVEL: null
      MONGO_URL: mongodb://mongodb:27017/gratibot
      REACTION_EMOJI: null
      RECOGNIZE_EMOJI: null
      REDEMPTION_ADMINS: null
      SLASH_COMMAND: null
    networks:
      default: null
    ports:
    - mode: ingress
      target: 3000
      published: "3000"
      protocol: tcp
  mongodb:
    image: mongo:4.2
    networks:
      default: null
    ports:
    - mode: ingress
      target: 27017
      published: "27017"
      protocol: tcp
networks:
  default:
    name: gratibot_default
```

Key observations:
- No `version:` field at the top level ✓
- No `entrypoint:` key on the `gratibot` service ✓
- All 13 environment variable pass-throughs preserved ✓
- `depends_on`, `ports`, `build`, `container_name` all intact ✓
- `mongodb` service definition unchanged ✓

## Reviewer Conclusion

`docker compose config` exits cleanly with no warnings, confirming the file is valid
under Compose Specification v2. The deprecated `version` field and redundant `entrypoint`
override are both absent, and all other service configuration is preserved intact.
