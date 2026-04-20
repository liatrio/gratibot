/* eslint-disable no-console */
/**
 * One-off spike for Unit 3 Task 3.1 of Spec 04.
 * Probes whether `files.sharedPublicURL` works for dev Gratibot's bot token.
 *
 * Usage:
 *   1. Upload an image into a DM with dev Gratibot (the file must be visible
 *      to the bot — uploading to a DM with the bot is easiest).
 *   2. Run:       node scripts/spike-shared-public-url.js
 *      - with no args: lists recent files visible to the bot so you can pick an ID.
 *   3. Then run:  node scripts/spike-shared-public-url.js F0123ABCDE
 *      - passing the file ID to exercise files.sharedPublicURL.
 *
 * Reads BOT_USER_OAUTH_ACCESS_TOKEN from .env (simple parser, no dotenv dep).
 *
 * Retained as a reproducibility aid for the SPIKE_FALLBACK decision recorded in
 * docs/specs/04-spec-db-backed-reward-management/04-proofs/3.0-spike.md.
 */
const fs = require("fs");
const path = require("path");
const { WebClient } = require("@slack/web-api");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env not found at repo root — cannot read BOT_USER_OAUTH_ACCESS_TOKEN");
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

(async () => {
  loadEnv();
  const token = process.env.BOT_USER_OAUTH_ACCESS_TOKEN;
  if (!token) {
    console.error("BOT_USER_OAUTH_ACCESS_TOKEN is not set in .env");
    process.exit(2);
  }
  const client = new WebClient(token);

  const fileId = process.argv[2];

  if (!fileId) {
    console.log("No file ID supplied — listing 10 most recent files visible to the bot.\n");
    try {
      const list = await client.files.list({ count: 10 });
      if (!list.files || list.files.length === 0) {
        console.log("(no files found — upload one to a DM with dev Gratibot first)");
      } else {
        list.files.forEach((f) => {
          console.log(`  ${f.id}  ${f.filetype.padEnd(6)}  ${f.name}`);
        });
      }
      console.log("\nRe-run with: node scripts/spike-shared-public-url.js <FILE_ID>");
    } catch (e) {
      console.log("files.list failed:");
      console.log(JSON.stringify({ message: e.message, data: e.data }, null, 2));
    }
    return;
  }

  console.log(`Calling files.sharedPublicURL for file=${fileId} ...\n`);
  try {
    const resp = await client.files.sharedPublicURL({ file: fileId });
    console.log("RESPONSE:");
    console.log(JSON.stringify(resp, null, 2));
  } catch (e) {
    console.log("CAUGHT:");
    console.log(JSON.stringify({ message: e.message, data: e.data }, null, 2));
  }
})();
