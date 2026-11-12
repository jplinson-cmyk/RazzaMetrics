import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const temp = path.resolve(".tmp");
mkdirSync(temp, { recursive: true });
const env = {
  ...process.env,
  TEMP: temp,
  TMP: temp,
  WRANGLER_SEND_METRICS: "false",
};
const hash = createHash("sha256").update("e2e-session").digest("hex");
writeFileSync(
  ".tmp/e2e-seed.sql",
  `DELETE FROM usage_budgets WHERE scope='e2e-user'; DELETE FROM projects WHERE owner_id='e2e-user'; DELETE FROM users WHERE id='e2e-user'; INSERT INTO users VALUES('e2e-user','e2e@example.com','E2E User','','2026-01-01'); INSERT INTO sessions VALUES('${hash}','e2e-user',${Date.now() + 3600000});`,
);
for (const args of [
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "razza-seo",
    "--local",
    "--persist-to",
    ".wrangler/e2e",
  ],
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "razza-seo",
    "--local",
    "--persist-to",
    ".wrangler/e2e",
    "--file",
    ".tmp/e2e-seed.sql",
  ],
  ["node_modules/@playwright/test/cli.js", "test"],
]) {
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
