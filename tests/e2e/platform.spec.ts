import { expect, test } from "@playwright/test";
test("real Worker and D1: project, keyword, CSV import, issue and export", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "razza_session",
      value: "e2e-session",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add project", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  // Exercise mutations through the same browser origin; UI verifies the saved data after reload.
  const project = await page.evaluate(async () => {
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/",
        name: "Browser Project",
      }),
    });
    return r.json();
  });
  expect(project.id).toBeTruthy();
  await page.reload();
  await expect(
    page.getByText("Browser Project", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keyword Ranking Rank", exact: true })
    .click();
  await page.evaluate(async (id) => {
    await fetch(`/api/projects/${id}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: "real tracked query" }),
    });
  }, project.id);
  await page.reload();
  await expect(
    page.getByRole("cell").filter({ hasText: "real tracked query" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /No Data/ }).first(),
  ).toBeVisible();
  const response = await page.evaluate(async (id) => {
    const r = await fetch(`/api/projects/${id}/backlinks/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "links.csv",
        text: "Linking sites,Links\nsource.example,3",
      }),
    });
    return r.json();
  }, project.id);
  expect(response.rowsInserted).toBe(1);
  await page.evaluate(async (id) => {
    await fetch(`/api/projects/${id}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Browser-created task",
        description: "Actual persisted issue",
      }),
    });
  }, project.id);
  await page.goto("/#issues");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser-created task", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: false })
    .first()
    .click();
  expect((await download).suggestedFilename()).toContain(".csv");
  await page.screenshot({ path: ".tmp/platform-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".tmp/platform-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/#overview");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    page.getByRole("region", { name: "Project analytics" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".tmp/platform-overview-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tmp/platform-overview-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Search current project" }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("textbox").fill("Browser-created");
  await expect(
    page.getByRole("dialog").getByText("Browser-created task", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Expand navigation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await page.goto("/#issues");
  await page.getByRole("button", { name: "Kanban board", exact: true }).click();
  await expect(page.locator(".kanban-column")).toHaveCount(3);
  await page
    .getByRole("combobox", {
      name: "Status for Browser-created task",
      exact: true,
    })
    .selectOption("in-progress");
  await expect(
    page
      .locator(".kanban-column")
      .filter({ has: page.getByRole("heading", { name: /IN-PROGRESS/ }) })
      .getByText("Browser-created task", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "Status for Browser-created task",
      exact: true,
    }),
  ).toHaveValue("in-progress");
});
test("manual login works without Google credentials and persists after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Razza Metrics", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid username or password.",
  );
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add project", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add project", exact: true }),
  ).toBeVisible();
});
