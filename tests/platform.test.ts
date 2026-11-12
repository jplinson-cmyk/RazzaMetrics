import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import worker, { authorizedProject } from "../server/index";
import { budget, digest, Env } from "../server/core";
import { crypt, accessToken, allowedGoogleEmail } from "../server/auth";
import {
  analyzeHtml,
  publicAddress,
  validateTarget,
  safeFetch,
  crawlPage,
} from "../server/crawler";
import { parseBacklinkCsv, importCsv, recalculate } from "../server/backlinks";
import { aggregate } from "../src/services/measurements";
import { abbreviate, auditSeverity, backlinkVelocity, countBy, dailySeries, delta, movers, positionDistribution, shareBy, topPages, vitalRating, weeklyVelocity } from "../src/services/explorer";
import { scoreBacklink } from "../src/services/toxicityEngine";
import { enqueue, runJobs } from "../server/jobs";
import { parseSitemap, sitemapSeeds } from "../server/sitemaps";

describe("upstream audit alignment", () => {
  it("separates index documents from pages and rejects out-of-scope locations", () => {
    expect(
      parseSitemap(
        "<sitemapindex><sitemap><loc>https://example.com/child.xml</loc></sitemap></sitemapindex>",
        "example.com",
        10,
      ),
    ).toEqual({ pages: [], sitemaps: ["https://example.com/child.xml"] });
    expect(
      parseSitemap(
        "<urlset><url><loc>https://example.com/page</loc></url><url><loc>https://evil.example/page</loc></url></urlset>",
        "example.com",
        10,
      ).pages,
    ).toEqual(["https://example.com/page"]);
    expect(
      sitemapSeeds(
        "Sitemap: https://example.com/a.xml\nSitemap: https://example.com/b.xml",
        "https://example.com/",
        "example.com",
      ),
    ).toHaveLength(3);
  });
  it("does not confuse blocked, error or JavaScript-only responses with complete content audits", () => {
    expect(
      analyzeHtml(
        "<html><title>Just a moment</title></html>",
        "https://example.com/",
        403,
      ).findings.map((f) => f.checkType),
    ).toEqual(["crawler_blocked"]);
    expect(
      analyzeHtml(
        '<div id="root"></div><script src="app.js"></script>',
        "https://example.com/",
      ).analysisStatus,
    ).toBe("javascript-required");
    expect(
      analyzeHtml("Missing", "https://example.com/", 404).findings.map(
        (f) => f.checkType,
      ),
    ).toEqual(["http_error"]);
  });
});

let sql: DatabaseSync;
let env: Env;
const manualHash =
  "1234567890abcdef1234567890abcdef:" +
  pbkdf2Sync(
    "admin123",
    Buffer.from("1234567890abcdef1234567890abcdef", "hex"),
    100000,
    32,
    "sha256",
  ).toString("hex");
function adapter(db: DatabaseSync) {
  const prepare = (query: string) => {
    let args: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        args = values;
        return statement;
      },
      async first() {
        return db.prepare(query).get(...(args as [])) || null;
      },
      async all() {
        return {
          results: db.prepare(query).all(...(args as [])),
          success: true,
        };
      },
      async run() {
        const r = db.prepare(query).run(...(args as []));
        return { success: true, meta: { changes: Number(r.changes) } };
      },
    };
    return statement;
  };
  return {
    prepare,
    async batch(statements: { run(): Promise<unknown> }[]) {
      db.exec("BEGIN");
      try {
        const r = [];
        for (const s of statements) r.push(await s.run());
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}
// Like the Workers runtime, background work handed to waitUntil finishes before the test tears down.
const pending: Promise<unknown>[] = [];
const context = { waitUntil: vi.fn((p: Promise<unknown>) => void pending.push(p)) } as unknown as ExecutionContext;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  origin = "https://app.example.com",
) {
  return worker.fetch(
    new Request("https://app.example.com/api" + path, {
      method,
      headers: {
        Cookie: "razza_session=test-session",
        Origin: origin,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env,
    context,
  );
}
beforeEach(async () => {
  sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("migrations/0001_platform.sql", "utf8"));
  sql.exec(readFileSync("migrations/0002_project_settings.sql", "utf8"));
  sql.exec(readFileSync("migrations/0003_ai_reports.sql", "utf8"));
  sql.exec(readFileSync("migrations/0004_ga4_property.sql", "utf8"));
  env = {
    DB: adapter(sql),
    APP_BASE_URL: "https://app.example.com",
    GOOGLE_REDIRECT_URI: "https://app.example.com/api/auth/callback",
    APP_ENCRYPTION_KEY: btoa("x".repeat(32)),
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    ASSETS: { fetch: vi.fn() },
  } as unknown as Env;
  sql
    .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .run("u1", "one@example.com", "One", "", "2026-01-01");
  sql
    .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .run("u2", "two@example.com", "Two", "", "2026-01-01");
  sql
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(await digest("test-session"), "u1", Date.now() + 100000);
  for (const [id, user, domain] of [
    ["p1", "u1", "example.com"],
    ["p2", "u2", "other.com"],
  ])
    sql
      .prepare(
        "INSERT INTO projects(id,owner_id,domain,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        user,
        domain,
        domain,
        "https://" + domain + "/",
        "2026-01-01",
        "2026-01-01",
      );
});
afterEach(async () => {
  await Promise.allSettled(pending.splice(0));
  vi.unstubAllGlobals();
  sql.close();
});

describe("authentication and authorization", () => {
  it("allows only verified company Google email addresses", () => {
    expect(allowedGoogleEmail("jp.linson@razzaconsulting.com", true)).toBe(
      true,
    );
    expect(allowedGoogleEmail("User@RAZZACONSULTING.COM", true)).toBe(true);
    for (const email of [
      "user@gmail.com",
      "user@razzaconsulting.com.evil.org",
      "user@sub.razzaconsulting.com",
      "user@razzaconsulting,com",
      "user@@razzaconsulting.com",
      " user@razzaconsulting.com",
    ])
      expect(allowedGoogleEmail(email, true)).toBe(false);
    expect(allowedGoogleEmail("user@razzaconsulting.com", false)).toBe(false);
    expect(allowedGoogleEmail("user@razzaconsulting.com", "true")).toBe(false);
  });
  it("manual login requires server configuration, validates credentials and issues a persistent HttpOnly session", async () => {
    expect(
      (
        await request("/auth/manual", "POST", {
          username: "admin",
          password: "admin123",
        })
      ).status,
    ).toBe(503);
    env.MANUAL_ADMIN_PASSWORD_HASH = manualHash;
    expect(
      (
        await request("/auth/manual", "POST", {
          username: "admin",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/auth/manual", "POST", {
          username: "other",
          password: "admin123",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/auth/manual",
          "POST",
          { username: "admin", password: "admin123" },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    const signedIn = await request("/auth/manual", "POST", {
      username: "admin",
      password: "admin123",
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    const session = await worker.fetch(
      new Request("https://app.example.com/api/session", {
        headers: { Cookie: cookie.split(";")[0] },
      }),
      env,
      context,
    );
    expect(await session.json()).toMatchObject({
      id: "manual-admin",
      role: "Super Admin",
    });
    const token = cookie.split(";")[0].split("=")[1];
    expect(
      sql.prepare("SELECT id FROM sessions WHERE id=?").get(token),
    ).toBeUndefined();
    expect((await authorizedProject(env, "u1", "p1")).owner_id).toBe("u1");
    await expect(
      authorizedProject(env, "manual-admin", "p1"),
    ).rejects.toThrow();
  });
  it("rate limits manual password guesses", async () => {
    env.MANUAL_ADMIN_PASSWORD_HASH = manualHash;
    sql
      .prepare("INSERT INTO usage_budgets VALUES(?,?,?,?)")
      .run(
        "manual-login:" + (await digest("local")),
        "attempts:" + new Date().toISOString().slice(0, 13),
        new Date().toISOString().slice(0, 10),
        20,
      );
    expect(
      (
        await request("/auth/manual", "POST", {
          username: "admin",
          password: "admin123",
        })
      ).status,
    ).toBe(429);
  });
  it("rejects missing sessions and cross-project reads/mutations", async () => {
    const r = await worker.fetch(
      new Request("https://app.example.com/api/projects"),
      env,
      context,
    );
    expect(r.status).toBe(401);
    expect((await request("/projects/p2/data")).status).toBe(404);
    expect((await request("/projects/p2", "DELETE")).status).toBe(404);
    await expect(authorizedProject(env, "u1", "p2")).rejects.toThrow(
      "Project not found",
    );
  });
  it("rejects CSRF, including logout", async () => {
    expect(
      (await request("/auth/logout", "POST", {}, "https://evil.example"))
        .status,
    ).toBe(403);
  });
  it("OAuth uses PKCE and state cookie; invalid callback is refused", async () => {
    const r = await request("/auth/login");
    const location = new URL(r.headers.get("Location")!);
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(r.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect((await request("/auth/callback?state=forged&code=x")).status).toBe(
      400,
    );
  });
  it("encrypts tokens and rejects tampering", async () => {
    const cipher = await crypt(env, "refresh-secret");
    expect(cipher).not.toContain("refresh-secret");
    expect(await crypt(env, cipher, true)).toBe("refresh-secret");
    await expect(
      crypt(env, cipher.slice(0, -4) + "xxxx", true),
    ).rejects.toThrow();
  });
  it("refreshes expiring tokens server-side", async () => {
    sql.prepare("INSERT INTO google_connections VALUES(?,?,?,?)").run(
      "u1",
      await crypt(
        env,
        JSON.stringify({
          access_token: "old",
          refresh_token: "refresh",
          expiresAt: 0,
        }),
      ),
      "",
      "2026",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ access_token: "new", expires_in: 3600 }),
      ),
    );
    expect(await accessToken(env, "u1")).toBe("new");
    expect(await accessToken(env, "u1")).toBe("new");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("projects and issues", () => {
  it("creates persistent projects and prevents duplicates", async () => {
    expect(
      (
        await request("/projects", "POST", {
          url: "https://new.example/",
          name: "New",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request("/projects", "POST", {
          url: "https://new.example/",
          name: "Duplicate",
        })
      ).status,
    ).toBe(409);
    const created = (await (await request("/projects")).json()) as {
      id: string;
      domain: string;
    }[];
    const newId = created.find((p) => p.domain === "new.example")!.id;
    expect(
      (await request(`/projects/${newId}/keywords`, "POST", { keyword: "seo" }))
        .status,
    ).toBeLessThan(300);
    const all = (await (await request("/projects")).json()) as {
      domain: string;
      keywords_count: number;
      referring_domains: number;
      pages_crawled: number | null;
    }[];
    expect(all).toHaveLength(2);
    // Portfolio counts come from the server, not placeholder zeros.
    const fresh = all.find((p) => p.domain === "new.example")!;
    expect(fresh.keywords_count).toBe(1);
    expect(fresh.referring_domains).toBe(0);
    expect(fresh.pages_crawled).toBeNull();
  });
  it("creates, resolves, reopens and records issue events", async () => {
    const issue = (await (
      await request("/projects/p1/issues", "POST", { title: "Fix title" })
    ).json()) as { id: string };
    const resolved = (await (
      await request("/projects/p1/issues/" + issue.id, "PATCH", {
        status: "resolved",
      })
    ).json()) as { resolvedAt: string };
    expect(resolved.resolvedAt).toBeTruthy();
    const reopened = (await (
      await request("/projects/p1/issues/" + issue.id, "PATCH", {
        status: "open",
      })
    ).json()) as { resolvedAt?: string };
    expect(reopened.resolvedAt).toBeUndefined();
    expect(
      (
        await request("/projects/p2/issues/" + issue.id, "PATCH", {
          status: "resolved",
        })
      ).status,
    ).toBe(404);
    const events = (await (
      await request("/projects/p1/issues/" + issue.id + "/events")
    ).json()) as unknown[];
    expect(events).toHaveLength(3);
  });
  it("cascades only the deleted project", async () => {
    await request("/projects/p1", "DELETE");
    expect(sql.prepare("SELECT id FROM projects").all()).toHaveLength(1);
  });
});
describe("imports and risk", () => {
  it("preserves domain-only unknowns and rejects invented aggregate relationships", () => {
    const rows = parseBacklinkCsv("Linking sites,Links\nexample.org,50");
    expect(rows[0].sourceDomain).toBe("example.org");
    expect(rows[0].sourceUrl).toBeUndefined();
    expect(() =>
      parseBacklinkCsv("Target page,Links\nhttps://example.com,10"),
    ).toThrow("aggregate");
    expect(() => parseBacklinkCsv('Source URL,Target URL\n"broken')).toThrow(
      "Malformed",
    );
  });
  it("reimport deduplicates while preserving reviews and first import dates", async () => {
    await importCsv(
      env,
      "p1",
      "Source URL,Target URL\nhttps://source.org/a,https://example.com/",
      "first.csv",
    );
    await importCsv(
      env,
      "p1",
      "Source URL,Target URL\nhttps://source.org/a,https://example.com/",
      "second.csv",
    );
    expect(sql.prepare("SELECT * FROM backlinks").all()).toHaveLength(1);
    expect(
      sql.prepare("SELECT * FROM backlink_import_batches").all(),
    ).toHaveLength(2);
    await recalculate(env, "p1");
    expect(
      sql.prepare("SELECT * FROM project_toxicity_snapshots").all(),
    ).toHaveLength(1);
  });
  it("keeps TLD a weak signal, and missing authority unknown", () => {
    const r = scoreBacklink({ id: "x", sourceDomain: "legit.xyz" }, []);
    expect(r.score).toBeLessThan(30);
    expect(r.signals.find((s) => s.code === "low_pagerank")?.known).toBe(false);
  });
});
describe("measurements, quotas and jobs", () => {
  it("weights average position and derives CTR from totals", () => {
    const r = aggregate([
      { clicks: 1, impressions: 10, position: 1 },
      { clicks: 9, impressions: 90, position: 11 },
    ] as never[]);
    expect(r.position).toBe(10);
    expect(r.ctr).toBe(10);
    expect(aggregate([]).position).toBeNaN();
  });
  it("atomically stops calls at a persistent quota", async () => {
    await budget(env, "global", "test", 1);
    await expect(budget(env, "global", "test", 1)).rejects.toThrow(
      "budget reached",
    );
  });
  it("deduplicates jobs and resumes saved Google pagination", async () => {
    sql
      .prepare("UPDATE projects SET gsc_property=? WHERE id=?")
      .run("https://example.com/", "p1");
    sql.prepare("INSERT INTO google_connections VALUES(?,?,?,?)").run(
      "u1",
      await crypt(
        env,
        JSON.stringify({
          access_token: "token",
          expiresAt: Date.now() + 3600000,
        }),
      ),
      "",
      "2026",
    );
    const id = await enqueue(env, "p1", "gsc", {
      date: "2026-01-01",
      endDate: "2026-01-01",
    });
    expect(await enqueue(env, "p1", "gsc", {})).toBe(id);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          rows: [
            {
              keys: [
                "2026-01-01",
                "query",
                "https://example.com/a",
                "DESKTOP",
                "phl",
              ],
              clicks: 2,
              impressions: 20,
              position: 3,
            },
            {
              keys: [
                "2026-01-01",
                "query",
                "https://example.com/b",
                "DESKTOP",
                "phl",
              ],
              clicks: 1,
              impressions: 10,
              position: 7,
            },
          ],
        }),
      ),
    );
    await runJobs(env, "p1");
    expect(sql.prepare("SELECT * FROM gsc_performance").all()).toHaveLength(2);
    expect(
      sql.prepare("SELECT status FROM background_jobs WHERE id=?").get(id)
        ?.status,
    ).toBe("COMPLETED");
    await enqueue(env, "p1", "gsc", {
      date: "2026-01-01",
      endDate: "2026-01-01",
    });
    await runJobs(env, "p1");
    expect(sql.prepare("SELECT * FROM gsc_performance").all()).toHaveLength(2);
  });
});
describe("crawler", () => {
  it.each([
    "http://example.com/",
    "https://localhost/",
    "https://127.0.0.1/",
    "https://example.com.evil.org/",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
  ])("blocks unsafe target %s", (value) =>
    expect(() => validateTarget(value, "example.com")).toThrow(),
  );
  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.1",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "2001:db8::1",
  ])("blocks nonpublic address %s", (ip) =>
    expect(publicAddress(ip)).toBe(false),
  );
  it("extracts actual missing tags, noindex and HTTP errors", () => {
    const page = analyzeHtml(
      '<html><head><meta name="robots" content="NOINDEX"></head><body><img src="x"><img src="decorative" alt=""></body></html>',
      "https://example.com/",
      200,
    );
    expect(page.findings.map((f) => f.checkType)).toEqual(
      expect.arrayContaining([
        "missing_title",
        "missing_description",
        "missing_h1",
        "missing_alt",
        "noindex",
        "missing_canonical",
      ]),
    );
    expect(page.images.filter((i) => !i.hasAlt)).toHaveLength(1);
  });
  it("checks DNS and refuses off-domain redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (value: unknown) =>
        String(value).includes("dns-query")
          ? Response.json({ Status: 0, Answer: [{ type: 1, data: "8.8.8.8" }] })
          : new Response(null, {
              status: 302,
              headers: { Location: "https://evil.example/" },
            }),
      ),
    );
    await expect(
      safeFetch(env, "https://example.com/", "example.com"),
    ).rejects.toThrow("exact project hostname");
  });
  it("does not fetch pages disallowed by robots", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      crawlPage(
        env,
        "https://example.com/private",
        "example.com",
        "User-agent: *\nDisallow: /private",
      ),
    ).rejects.toThrow("robots");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("persists findings and reconciles resolved and recurring issues", async () => {
    let html = "<html><body><p>Real missing tags</p></body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (value: unknown) => {
        const url = String(value);
        if (url.includes("dns-query"))
          return Response.json({
            Status: 0,
            Answer: [{ type: 1, data: "8.8.8.8" }],
          });
        if (url.endsWith("/robots.txt"))
          return new Response("", { status: 404 });
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }),
    );
    await enqueue(env, "p1", "crawl", { maxPages: 1, maxDepth: 0 });
    await runJobs(env, "p1");
    const first = sql
      .prepare("SELECT data FROM seo_issues WHERE project_id=?")
      .all("p1");
    expect(first.length).toBeGreaterThan(0);
    html =
      '<html><head><title>A complete and descriptive page title</title><meta name="description" content="Description"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body><h1>Heading</h1><img src="decorative" alt=""></body></html>';
    await enqueue(env, "p1", "crawl", { maxPages: 1, maxDepth: 0 });
    await runJobs(env, "p1");
    expect(
      sql
        .prepare("SELECT data FROM seo_issues")
        .all()
        .every((r) => JSON.parse(String(r.data)).status === "resolved"),
    ).toBe(true);
    html = "<html><body>Missing again</body></html>";
    await enqueue(env, "p1", "crawl", { maxPages: 1, maxDepth: 0 });
    await runJobs(env, "p1");
    expect(
      sql
        .prepare("SELECT data FROM seo_issues")
        .all()
        .every((r) => JSON.parse(String(r.data)).status === "open"),
    ).toBe(true);
  });
});
describe("integration contracts", () => {
  it("cancels an in-flight crawl without saving new findings or changing cancellation back to queued", async () => {
    const id = await enqueue(env, "p1", "crawl", { maxPages: 1, maxDepth: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (value: unknown) => {
        const url = String(value);
        if (url.includes("dns-query"))
          return Response.json({
            Status: 0,
            Answer: [{ type: 1, data: "8.8.8.8" }],
          });
        if (url.endsWith("/robots.txt"))
          return new Response("", { status: 404 });
        await request(`/projects/p1/jobs/${id}/cancel`, "POST", {});
        return new Response("<html>Missing tags</html>", {
          headers: { "Content-Type": "text/html" },
        });
      }),
    );
    await runJobs(env, "p1");
    expect(
      sql.prepare("SELECT status FROM background_jobs WHERE id=?").get(id)
        ?.status,
    ).toBe("CANCELLED");
    expect(sql.prepare("SELECT * FROM page_audit_findings").all()).toHaveLength(
      0,
    );
    expect(
      JSON.parse(String(sql.prepare("SELECT data FROM audit_runs").get()?.data))
        .status,
    ).toBe("cancelled");
  });
  it("retains pending crawl work on failure and stops after four attempts", async () => {
    const id = await enqueue(env, "p1", "crawl", { maxPages: 1, maxDepth: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    );
    for (let attempt = 0; attempt < 4; attempt++) {
      sql
        .prepare("UPDATE background_jobs SET next_attempt=0 WHERE id=?")
        .run(id);
      await runJobs(env, "p1");
    }
    const job = sql
      .prepare("SELECT * FROM background_jobs WHERE id=?")
      .get(id)!;
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(4);
    expect(job.completed_at).toBeTruthy();
    expect(JSON.parse(String(job.payload)).queue[0].url).toBe(
      "https://example.com/",
    );
  });
  it("completes OAuth once and never returns tokens to the browser", async () => {
    const begin = await request("/auth/login");
    const state = new URL(begin.headers.get("Location")!).searchParams.get(
      "state",
    )!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (value: unknown) =>
        String(value).includes("/token")
          ? Response.json({
              access_token: "access-secret",
              refresh_token: "refresh-secret",
              expires_in: 3600,
              scope:
                "openid email https://www.googleapis.com/auth/webmasters.readonly",
            })
          : Response.json({
              sub: "u1",
              email: "one@razzaconsulting.com",
              email_verified: true,
              name: "One",
            }),
      ),
    );
    const req = () =>
      new Request(
        `https://app.example.com/api/auth/callback?state=${state}&code=code`,
        { headers: { Cookie: `razza_oauth=${state}` } },
      );
    const completed = await worker.fetch(req(), env, context);
    expect(completed.status).toBe(302);
    expect(await completed.text()).not.toContain("secret");
    expect(completed.headers.get("Set-Cookie")).toContain("Secure");
    expect((await worker.fetch(req(), env, context)).status).toBe(400);
    expect(
      String(
        sql.prepare("SELECT encrypted_tokens FROM google_connections").get()
          ?.encrypted_tokens,
      ),
    ).not.toContain("refresh-secret");
  });
  it("rejects unverified property selection", async () => {
    sql.prepare("INSERT INTO google_connections VALUES(?,?,?,?)").run(
      "u1",
      await crypt(
        env,
        JSON.stringify({
          access_token: "access",
          expiresAt: Date.now() + 3600000,
        }),
      ),
      "",
      "2026",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          siteEntry: [
            {
              siteUrl: "https://example.com/",
              permissionLevel: "siteUnverifiedUser",
            },
          ],
        }),
      ),
    );
    expect(
      (
        await request("/projects/p1", "PATCH", {
          gscProperty: "https://example.com/",
        })
      ).status,
    ).toBe(403);
  });
  it("disconnect revokes and clears selected properties", async () => {
    sql
      .prepare("INSERT INTO google_connections VALUES(?,?,?,?)")
      .run(
        "u1",
        await crypt(
          env,
          JSON.stringify({ access_token: "access", refresh_token: "refresh" }),
        ),
        "",
        "2026",
      );
    sql
      .prepare("UPDATE projects SET gsc_property=? WHERE id=?")
      .run("https://example.com/", "p1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("")),
    );
    expect((await request("/google/disconnect", "POST", {})).status).toBe(200);
    expect(sql.prepare("SELECT * FROM google_connections").all()).toHaveLength(
      0,
    );
    expect(
      sql.prepare("SELECT gsc_property FROM projects WHERE id=?").get("p1")
        ?.gsc_property,
    ).toBeNull();
  });
  it("saves validated project-specific rules", async () => {
    expect(
      (
        await request("/projects/p1/settings", "PUT", {
          opportunities: { minImpressions: 500 },
        })
      ).status,
    ).toBe(200);
    const rules = (await (await request("/projects/p1/settings")).json()) as {
      opportunities: { minImpressions: number };
    };
    expect(rules.opportunities.minImpressions).toBe(500);
    expect((await request("/projects/p2/settings")).status).toBe(404);
    expect(
      (
        await request("/projects/p1/settings", "PUT", {
          toxicity: { suspiciousTldPoints: 90 },
        })
      ).status,
    ).toBe(400);
  });
  it("saves real PageSpeed lab scores and keeps missing field metrics unknown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          lighthouseResult: {
            categories: {
              performance: { score: 0.8 },
              accessibility: { score: 1 },
              seo: { score: 0.9 },
              "best-practices": { score: 0.95 },
            },
            audits: { "largest-contentful-paint": { numericValue: 2500 } },
          },
        }),
      ),
    );
    await enqueue(env, "p1", "pagespeed", {
      url: "https://example.com/",
      strategy: "mobile",
    });
    await runJobs(env, "p1");
    const result = JSON.parse(
      String(sql.prepare("SELECT data FROM pagespeed_results").get()?.data),
    );
    expect(result.performance).toBe(80);
    expect(result.labLcp).toBe(2.5);
    expect(result.lcp).toBeUndefined();
    expect(result.inp).toBeUndefined();
  });
  it("runs a PageSpeed test ahead of an older Search Console backfill", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ lighthouseResult: { categories: { performance: { score: 0.7 } }, audits: {} } }),
    ));
    // Queue the long sync first, then the quick test, and hold the sync back so only one batch can run.
    await enqueue(env, "p1", "gsc", { date: "2026-01-01", endDate: "2026-03-01" });
    await enqueue(env, "p1", "pagespeed", { url: "https://example.com/", strategy: "desktop" });
    sql.prepare("UPDATE background_jobs SET created_at='2000-01-01' WHERE type='gsc'").run();
    await runJobs(env, "p1", 0);
    const jobs = Object.fromEntries(
      (sql.prepare("SELECT type, status FROM background_jobs").all() as { type: string; status: string }[]).map((j) => [j.type, j.status]),
    );
    expect(jobs.pagespeed).toBe("COMPLETED");
    expect(jobs.gsc).toBe("QUEUED");
  });
  it("leaves PageSpeed to the cron when a screen's poll skips it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await enqueue(env, "p1", "pagespeed", { url: "https://example.com/", strategy: "mobile" });
    await runJobs(env, "p1", 0, ["pagespeed"]);
    expect(sql.prepare("SELECT status FROM background_jobs WHERE type='pagespeed'").get()).toEqual({ status: "QUEUED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("site explorer analytics", () => {
  const row = (date: string, keyword: string, page: string, clicks: number, impressions: number, position: number) =>
    ({ date, keyword, page, clicks, impressions, position, device: "DESKTOP", country: "usa" });
  it("abbreviates axis ticks", () => {
    expect(abbreviate(12500)).toBe("12.5K");
    expect(abbreviate(1200000)).toBe("1.2M");
    expect(abbreviate(950)).toBe("950");
    expect(abbreviate(NaN)).toBe("No Data");
  });
  it("builds daily series with gaps and distinct keyword counts", () => {
    const s = dailySeries([row("2026-01-01", "a", "/x", 3, 10, 2), row("2026-01-01", "b", "/x", 1, 5, 8)], "2026-01-01", "2026-01-02");
    expect(s[0]).toEqual({ date: "2026-01-01", clicks: 4, impressions: 15, keywords: 2 });
    expect(Number.isNaN(s[1].clicks)).toBe(true);
  });
  it("computes deltas only against a real previous value", () => {
    expect(delta(112.4, 100)).toBeCloseTo(12.4);
    expect(Number.isNaN(delta(5, 0))).toBe(true);
  });
  it("buckets positions into five ranges", () => {
    expect(positionDistribution([1, 3.4, 4, 15, 60, 101, NaN]).map((b) => b.count)).toEqual([2, 1, 1, 0, 1]);
  });
  it("ranks pages by clicks with their top keyword and share", () => {
    const p = topPages([row("2026-01-01", "a", "/x", 3, 10, 2), row("2026-01-01", "b", "/x", 5, 9, 4), row("2026-01-01", "c", "/y", 2, 4, 9)], []);
    expect(p[0]).toMatchObject({ page: "/x", clicks: 8, topKeyword: "b", share: 80 });
    expect(Number.isNaN(p[0].previousClicks)).toBe(true);
  });
  it("counts new and lost referring domains inside the period", () => {
    const v = backlinkVelocity([
      { sourceDomain: "new.com", firstSeen: "2026-01-05", lastSeen: "2026-01-30" },
      { sourceDomain: "gone.com", firstSeen: "2025-06-01", lastSeen: "2026-01-10" },
      { sourceDomain: "old.com", firstSeen: "2025-06-01", lastSeen: "2026-01-30" },
    ], "2026-01-01", "2026-01-30");
    expect(v).toMatchObject({ gained: ["new.com"], lost: ["gone.com"], total: 3, dated: true });
  });
  it("does not count links still live at export as lost", () => {
    // CSV exported on 1 Nov: every live link says "last seen 1 Nov"; viewed on 12 Nov.
    const v = backlinkVelocity([
      { sourceDomain: "a.com", firstSeen: "2026-06-01", lastSeen: "2026-11-01" },
      { sourceDomain: "b.com", firstSeen: "2026-06-01", lastSeen: "2026-11-01" },
      { sourceDomain: "dropped.com", firstSeen: "2026-06-01", lastSeen: "2026-10-20" },
    ], "2026-10-14", "2026-11-12");
    expect(v.lost).toEqual(["dropped.com"]);
  });
});

describe("login contour field", () => {
  it("traces a closed level line through a single peak", async () => {
    const { contourSegments } = await import("../src/components/auth/ContourField");
    // A cone peaking at (40, 40): the 0.5 contour is a ring of radius 20.
    const field = (x: number, y: number) => 1 - Math.hypot(x - 40, y - 40) / 40;
    const seg = contourSegments(field, 80, 80, 4, 0.5);
    expect(seg.length).toBeGreaterThan(40);
    for (let i = 0; i < seg.length; i += 2) expect(Math.abs(Math.hypot(seg[i] - 40, seg[i + 1] - 40) - 20)).toBeLessThan(1.5);
  });
});

describe("explorer breakdowns", () => {
  const row = (device: string, country: string, clicks: number, impressions: number) =>
    ({ date: "2026-01-01", keyword: "k", page: "/", position: 3, device, country, clicks, impressions });
  it("splits clicks by device with shares that add to 100", () => {
    const s = shareBy([row("DESKTOP", "usa", 30, 100), row("MOBILE", "usa", 60, 200), row("mobile", "phl", 10, 50)], "device");
    expect(s.map((d) => [d.name, d.clicks, Math.round(d.share)])).toEqual([["mobile", 70, 70], ["desktop", 30, 30]]);
    expect(shareBy([], "country")).toEqual([]);
  });
  it("finds the biggest gainers and losers, ignoring keywords without both periods", () => {
    const m = movers([
      { keyword: "up", position: 3, previousPosition: 9 },
      { keyword: "down", position: 20, previousPosition: 12 },
      { keyword: "flat", position: 5, previousPosition: 5 },
      { keyword: "new", position: 4, previousPosition: NaN },
    ]);
    expect(m.gainers.map((k) => [k.keyword, k.change])).toEqual([["up", 6]]);
    expect(m.losers.map((k) => [k.keyword, k.change])).toEqual([["down", -8]]);
  });
});

describe("backlink and audit charts", () => {
  it("bins new and lost domains into weeks ending at the newest last-seen date", () => {
    const w = weeklyVelocity([
      { sourceDomain: "new.com", firstSeen: "2026-11-10", lastSeen: "2026-11-12" },
      { sourceDomain: "gone.com", firstSeen: "2026-01-01", lastSeen: "2026-11-02" },
      { sourceDomain: "live.com", firstSeen: "2026-01-01", lastSeen: "2026-11-12" },
    ], 2);
    expect(w).toEqual([
      { from: "2026-10-30", to: "2026-11-05", gained: 0, lost: 1 },
      { from: "2026-11-06", to: "2026-11-12", gained: 1, lost: 0 },
    ]);
    expect(weeklyVelocity([])).toEqual([]);
  });
  it("counts groups with shares", () => {
    expect(countBy(["a", "b", "a"], (x) => x)).toEqual([{ name: "a", value: 2, share: (2 / 3) * 100 }, { name: "b", value: 1, share: (1 / 3) * 100 }]);
  });
  it("counts findings per severity for completed audits in date order", () => {
    const s = auditSeverity(
      [{ id: "b", status: "completed", completedAt: "2026-02-01T00:00:00Z" }, { id: "a", status: "completed", completedAt: "2026-01-01T00:00:00Z" }, { id: "c", status: "running" }],
      [{ auditId: "a", severity: "error" }, { auditId: "a", severity: "notice" }, { auditId: "b", severity: "warning" }],
    );
    expect(s).toEqual([
      { id: "a", date: "2026-01-01", error: 1, warning: 0, notice: 1 },
      { id: "b", date: "2026-02-01", error: 0, warning: 1, notice: 0 },
    ]);
  });
  it("rates Core Web Vitals on Google's thresholds", () => {
    expect([vitalRating("lcp", 2.5), vitalRating("lcp", 3), vitalRating("lcp", 4.1), vitalRating("cls", undefined)]).toEqual(["good", "improve", "poor", "none"]);
  });
});

describe("new sites", () => {
  it("queue their first full site audit as soon as they are added", async () => {
    // No real network in tests: every fetch the crawler makes gets a tiny HTML page.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><head><title>Home</title></head><body><h1>Home</h1></body></html>", { headers: { "content-type": "text/html" } })));
    const res = await request("/projects", "POST", { url: "https://newsite.example/", name: "New site" });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const job = sql.prepare("SELECT type, payload FROM background_jobs WHERE project_id=? AND type='crawl'").get(id) as { type: string; payload: string } | undefined;
    expect(job?.type).toBe("crawl");
    expect(JSON.parse(job!.payload)).toMatchObject({ maxPages: expect.any(Number), maxDepth: expect.any(Number) });
    expect(JSON.parse(job!.payload).maxPages).toBeGreaterThan(1);
  });
});

describe("automatic Google linking", () => {
  it("matches Search Console properties with or without www and across subdomains", async () => {
    const { gscPropertyMatches } = await import("../server/analytics");
    expect(gscPropertyMatches("razzaconsulting.com", "https://www.razzaconsulting.com/")).toBe(true);
    expect(gscPropertyMatches("www.razzaconsulting.com", "https://razzaconsulting.com/")).toBe(true);
    expect(gscPropertyMatches("blog.razzaconsulting.com", "sc-domain:razzaconsulting.com")).toBe(true);
    expect(gscPropertyMatches("razzaconsulting.com.evil.io", "sc-domain:razzaconsulting.com")).toBe(false);
    expect(gscPropertyMatches("other.com", "https://razzaconsulting.com/")).toBe(false);
  });
  it("links the best verified property and starts a sync when a site is added", async () => {
    const { autoLinkGoogle } = await import("../server/analytics");
    const owner = (sql.prepare("SELECT owner_id FROM projects WHERE id='p1'").get() as { owner_id: string }).owner_id;
    sql.prepare("INSERT INTO projects(id,owner_id,domain,name,url,created_at,updated_at) VALUES('p9',?,'example.org','Example','https://example.org/','2026-01-01','2026-01-01')").run(owner);
    const linked = await autoLinkGoogle(env, { id: "p9", owner_id: owner, domain: "example.org" }, async () => [
      { siteUrl: "https://www.example.org/", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:example.org", permissionLevel: "siteFullUser" },
      { siteUrl: "sc-domain:other.org", permissionLevel: "siteOwner" },
    ]);
    expect(linked.gscProperty).toBe("sc-domain:example.org");
    expect(linked.ga4Property).toBeUndefined(); // no Google connection for this owner: skipped, not thrown
    expect(sql.prepare("SELECT gsc_property FROM projects WHERE id='p9'").get()).toEqual({ gsc_property: "sc-domain:example.org" });
  });
  it("still adds the site when Google is not connected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><title>x</title></html>", { headers: { "content-type": "text/html" } })));
    const res = await request("/projects", "POST", { url: "https://unlinked.example/", code: "RZ-104" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ domain: "unlinked.example", name: "unlinked.example", code: "RZ-104", gsc_property: null });
  });
});

describe("Core Web Vitals coverage", () => {
  it("uses site-wide real-visitor data when the page has none, and records lab TBT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({
        lighthouseResult: { categories: { performance: { score: 0.6 } }, audits: { "total-blocking-time": { numericValue: 450 } } },
        loadingExperience: { metrics: {} },
        originLoadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3100 }, INTERACTION_TO_NEXT_PAINT: { percentile: 180 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5 } } },
      }),
    ));
    await enqueue(env, "p1", "pagespeed", { url: "https://example.com/", strategy: "mobile" });
    await runJobs(env, "p1");
    const r = JSON.parse(String(sql.prepare("SELECT data FROM pagespeed_results").get()?.data));
    expect(r).toMatchObject({ fieldScope: "site", lcp: 3.1, inp: 0.18, cls: 0.05, labTbt: 0.45 });
  });
  it("rates Total Blocking Time on Google's lab thresholds", () => {
    expect([vitalRating("tbt", 0.15), vitalRating("tbt", 0.45), vitalRating("tbt", 0.9)]).toEqual(["good", "improve", "poor"]);
  });
});
