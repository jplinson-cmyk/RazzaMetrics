import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
const temp = path.resolve(".tmp");
mkdirSync(temp, { recursive: true });
const child = spawn(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      TEMP: temp,
      TMP: temp,
      WRANGLER_SEND_METRICS: "false",
    },
  },
);
child.on("exit", (code) => process.exit(code || 0));
