import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pbkdf2Sync } from "node:crypto";
const temp = path.resolve(".tmp");
mkdirSync(temp, { recursive: true });
const args = [
  "node_modules/wrangler/bin/wrangler.js",
  "dev",
  ...(process.argv.includes("--e2e")
    ? [
        "--persist-to",
        ".wrangler/e2e",
        "--port",
        "8788",
        "--var",
        "APP_BASE_URL:http://localhost:8788",
        "--var",
        "MANUAL_ADMIN_USERNAME:admin",
        "--var",
        "MANUAL_ADMIN_PASSWORD_HASH:1234567890abcdef1234567890abcdef:" +
          pbkdf2Sync(
            "admin123",
            Buffer.from("1234567890abcdef1234567890abcdef", "hex"),
            100000,
            32,
            "sha256",
          ).toString("hex"),
      ]
    : []),
];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    TEMP: temp,
    TMP: temp,
    WRANGLER_SEND_METRICS: "false",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
