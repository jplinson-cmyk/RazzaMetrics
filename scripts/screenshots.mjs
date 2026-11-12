// Regenerates the README screenshots in docs/screenshots.
// Needs the local test server (`node scripts/dev-worker.mjs --e2e`, port 8788) and its test login.
// The screens show whatever data the local .wrangler/e2e database holds.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SCREENSHOT_URL || "http://localhost:8788";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const shoot = async (page, name, opts = {}) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log("saved", name);
};

async function session(viewport, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate((dark) => localStorage.setItem("razzaseo_theme_soft_v1", dark ? "dark" : "light"), colorScheme === "dark");
  return { ctx, page };
}

// Signed out: the sign-in page.
{
  const { ctx, page } = await session({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole("heading", { name: "Razza Metrics", exact: true }).waitFor();
  await shoot(page, "sign-in");
  await page.getByLabel("Username", { exact: true }).fill(process.env.SCREENSHOT_USER || "admin");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SCREENSHOT_PASSWORD || "admin123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator(".kpi-strip").waitFor({ timeout: 20000 });
  await page.evaluate(() => localStorage.setItem("razza_sidebar_collapsed", "false"));
  const views = [
    ["overview", "overview"],
    ["organic", "organic-keywords"],
    ["pages", "top-pages"],
    ["backlinks", "backlink-profile"],
    ["onpage", "site-audit"],
  ];
  for (const [hash, name] of views) {
    await page.evaluate((h) => (location.hash = h), hash);
    await page.waitForTimeout(900);
    await shoot(page, name);
  }
  // Charts further down each view, captured element by element.
  await page.evaluate(() => (location.hash = "overview"));
  await page.waitForTimeout(900);
  await page.locator("section:has(#trend-title)").screenshot({ path: `${OUT}/trend-chart.png` });
  await page.evaluate(() => (location.hash = "organic"));
  await page.waitForTimeout(900);
  await page.locator("section:has(#ctr-title)").screenshot({ path: `${OUT}/ctr-scatter.png` });
  console.log("saved trend-chart, ctr-scatter");
  const state = await ctx.storageState();
  await ctx.close();

  // Dark mode and a phone, reusing the signed-in session.
  for (const [name, viewport, scheme] of [["overview-dark", { width: 1440, height: 900 }, "dark"], ["overview-phone", { width: 390, height: 844 }, "light"]]) {
    const c = await browser.newContext({ viewport, colorScheme: scheme, storageState: state, deviceScaleFactor: scheme === "light" && viewport.width < 500 ? 2 : 1 });
    const p = await c.newPage();
    await p.goto(BASE + "/#overview");
    await p.evaluate((dark) => localStorage.setItem("razzaseo_theme_soft_v1", dark ? "dark" : "light"), scheme === "dark");
    await p.reload();
    await p.locator(".kpi-strip").waitFor({ timeout: 20000 });
    await shoot(p, name);
    await c.close();
  }
}
await browser.close();
