import { z } from "zod";
import { seoAdvice, SEO_MODELS } from "./ai";
import {
  beginOAuth,
  callback,
  disconnect,
  identity,
  logout,
  manualLogin,
  manualLoginConfigured,
  MANUAL_ADMIN_ID,
} from "./auth";
import { importCsv } from "./backlinks";
import {
  budget,
  digest,
  Env,
  HttpError,
  json,
  now,
  objects,
  readBody,
  rows,
  stmt,
  uid,
} from "./core";
import { validateTarget } from "./crawler";
import {
  dateAgo,
  enqueue,
  googleJson,
  JobPayload,
  ProjectRow,
  runJobs,
  scheduled,
} from "./jobs";
import { settings, settingsSchema } from "./settings";

export async function authorizedProject(env: Env, userId: string, id: string) {
  const p = await stmt(
    env,
    "SELECT * FROM projects WHERE id=? AND owner_id=?",
    id,
    userId,
  ).first<ProjectRow>();
  if (!p) throw new HttpError(404, "Project not found.");
  return p;
}
const issueSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10000).default(""),
  url: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .optional()
    .or(z.literal("")),
  severity: z.enum(["error", "warning", "notice"]).default("warning"),
  status: z.enum(["open", "in-progress", "resolved"]).default("open"),
  issueType: z.string().max(100).default("manual"),
  category: z.string().max(100).optional(),
  recommendation: z.string().max(10000).optional(),
  assignedTo: z.string().max(200).optional(),
  estimatedImpact: z.enum(["High", "Medium", "Low"]).optional(),
});
async function saveIssue(
  env: Env,
  projectId: string,
  userId: string,
  body: unknown,
  id?: string,
) {
  const existing = id
    ? await stmt(
        env,
        "SELECT data FROM seo_issues WHERE id=? AND project_id=?",
        id,
        projectId,
      ).first<{ data: string }>()
    : null;
  if (id && !existing) throw new HttpError(404, "Issue not found.");
  const old = existing ? JSON.parse(existing.data) : {};
  const parsed = issueSchema.parse({ ...old, ...(body as object) });
  const time = now();
  const issueId = id || uid();
  const data = {
    ...old,
    ...parsed,
    id: issueId,
    projectId,
    source: old.source || "manual",
    firstDetectedAt: old.firstDetectedAt || time,
    lastDetectedAt: old.lastDetectedAt || time,
    createdAt: old.createdAt || time,
    updatedAt: time,
    resolvedAt:
      parsed.status === "resolved" ? old.resolvedAt || time : undefined,
  };
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO seo_issues VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      issueId,
      projectId,
      old.fingerprint || issueId,
      JSON.stringify(data),
      data.createdAt,
      time,
    ),
    stmt(
      env,
      "INSERT INTO issue_events VALUES(?,?,?,?,?)",
      uid(),
      issueId,
      userId,
      JSON.stringify({ before: old, after: data }),
      time,
    ),
  ]);
  return data;
}
async function api(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/api/auth/login") return beginOAuth(req, env);
  if (path === "/api/auth/callback") return callback(req, env);
  if (path === "/api/config" && req.method === "GET")
    return json({
      googleConfigured: !!(
        env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET &&
        env.APP_ENCRYPTION_KEY
      ),
      name: "Razza Metrics",
      manualConfigured: manualLoginConfigured(env),
    });
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.get("Origin") !== new URL(env.APP_BASE_URL).origin
  )
    throw new HttpError(403, "Request origin validation failed.");
  if (path === "/api/auth/manual" && req.method === "POST") {
    const body = z
      .object({
        username: z.string().trim().min(1).max(100),
        password: z.string().min(1).max(256),
      })
      .parse(await readBody(req));
    return manualLogin(req, env, body.username, body.password);
  }
  const user = await identity(req, env);
  if (path === "/api/session")
    return json({
      ...user,
      role: user.id === MANUAL_ADMIN_ID ? "Super Admin" : "SEO Lead",
    });
  if (path === "/api/auth/logout" && req.method === "POST")
    return logout(req, env);
  if (path === "/api/google/disconnect" && req.method === "POST")
    return disconnect(env, user.id);
  if (path === "/api/google/status")
    return json({
      connected: !!(await stmt(
        env,
        "SELECT user_id FROM google_connections WHERE user_id=?",
        user.id,
      ).first()),
    });
  if (path === "/api/google/properties" && req.method === "GET")
    return json(
      (
        await googleJson<{
          siteEntry?: { siteUrl: string; permissionLevel: string }[];
        }>(env, user.id, "/sites")
      ).siteEntry || [],
    );
  if (path === "/api/projects") {
    if (req.method === "GET")
      return json(
        await rows<ProjectRow>(
          env,
          // Counts for every site so the portfolio never shows placeholder zeros; on-page checks (maxPages 1) are not site crawls.
          `SELECT p.*,
            (SELECT COUNT(*) FROM tracked_keywords k WHERE k.project_id=p.id) AS keywords_count,
            (SELECT COUNT(DISTINCT json_extract(b.data,'$.sourceDomain')) FROM backlinks b WHERE b.project_id=p.id) AS referring_domains,
            (SELECT json_extract(a.data,'$.pagesCrawled') FROM audit_runs a WHERE a.project_id=p.id AND json_extract(a.data,'$.status')='completed' AND json_extract(a.data,'$.scope.maxPages')>1 ORDER BY a.created_at DESC LIMIT 1) AS pages_crawled
          FROM projects p WHERE p.owner_id=? AND p.status='active' ORDER BY p.created_at DESC LIMIT 100`,
          user.id,
        ),
      );
    if (req.method === "POST") {
      await budget(env, user.id, "project-create", 50);
      const b = z
        .object({
          url: z.string().max(2048),
          name: z.string().trim().min(1).max(200),
        })
        .parse(await readBody(req));
      let value: URL;
      try {
        value = new URL(b.url.includes("://") ? b.url : "https://" + b.url);
      } catch {
        throw new HttpError(400, "Enter a valid website URL.");
      }
      const valid = validateTarget(value.href, value.hostname);
      const id = uid();
      const time = now();
      if (
        await stmt(
          env,
          "SELECT id FROM projects WHERE owner_id=? AND domain=?",
          user.id,
          valid.hostname,
        ).first()
      )
        throw new HttpError(409, "This website already has a project.");
      await stmt(
        env,
        "INSERT INTO projects(id,owner_id,domain,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        id,
        user.id,
        valid.hostname,
        b.name,
        valid.href,
        time,
        time,
      ).run();
      // Every new site gets its first full audit right away, the same job "Run Live Audit" queues.
      await enqueue(env, id, "crawl", {
        maxPages: Math.min(25, Number(env.CRAWLER_MAX_PAGES || 25)),
        maxDepth: Math.min(3, Number(env.CRAWLER_MAX_DEPTH || 3)),
      });
      ctx.waitUntil(runJobs(env, id));
      return json(await authorizedProject(env, user.id, id), 201);
    }
  }
  const match = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
  if (!match) throw new HttpError(404, "API route not found.");
  const p = await authorizedProject(env, user.id, decodeURIComponent(match[1]));
  const action = match[2] || "";
  if (action === "ai" && req.method === "GET")
    return json({
      models: SEO_MODELS,
      reports: await objects(env, "ai_reports", p.id, 20),
      configured: !!env.NVIDIA_API_KEY,
    });
  if (action === "ai" && req.method === "POST") {
    const b = z
      .object({
        question: z.string().trim().min(3).max(3000),
        model: z.enum(SEO_MODELS).default(SEO_MODELS[0]),
      })
      .parse(await readBody(req));
    return json(await seoAdvice(env, p, b.question, b.model));
  }
  if (action === "settings" && req.method === "GET")
    return json(await settings(env, p.id));
  if (action === "settings" && req.method === "PUT") {
    const parsed = settingsSchema.parse(await readBody(req));
    await stmt(
      env,
      "INSERT INTO project_settings VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      p.id,
      JSON.stringify(parsed),
      now(),
    ).run();
    await enqueue(env, p.id, "toxicity", {});
    return json(parsed);
  }
  if (!action && req.method === "DELETE") {
    await stmt(
      env,
      "DELETE FROM projects WHERE id=? AND owner_id=?",
      p.id,
      user.id,
    ).run();
    return json({ deleted: true });
  }
  if (!action && req.method === "PATCH") {
    const b = z
      .object({
        name: z.string().trim().min(1).max(200).optional(),
        gscProperty: z.string().max(2048).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(await readBody(req));
    if (b.gscProperty) {
      const properties = await googleJson<{
        siteEntry?: { siteUrl: string; permissionLevel: string }[];
      }>(env, user.id, "/sites");
      if (
        !properties.siteEntry?.some(
          (s) =>
            s.siteUrl === b.gscProperty &&
            s.permissionLevel !== "siteUnverifiedUser",
        )
      )
        throw new HttpError(
          403,
          "This Google account does not have verified access to that property.",
        );
      const propertyHost = b.gscProperty.startsWith("sc-domain:")
        ? b.gscProperty.slice(10)
        : new URL(b.gscProperty).hostname;
      if (
        p.domain !== propertyHost &&
        !(
          b.gscProperty.startsWith("sc-domain:") &&
          p.domain.endsWith("." + propertyHost)
        )
      )
        throw new HttpError(
          400,
          "Property does not match the project website.",
        );
    }
    await stmt(
      env,
      "UPDATE projects SET name=?,gsc_property=?,status=?,updated_at=? WHERE id=? AND owner_id=?",
      b.name || p.name,
      b.gscProperty === undefined ? p.gsc_property : b.gscProperty || null,
      b.status || "active",
      now(),
      p.id,
      user.id,
    ).run();
    if (b.gscProperty)
      await enqueue(env, p.id, "gsc", {
        date: dateAgo(93),
        endDate: dateAgo(3),
      });
    return json(await authorizedProject(env, user.id, p.id));
  }
  if (action === "data" && req.method === "GET") {
    const start = z.iso
      .date()
      .parse(url.searchParams.get("start") || dateAgo(28));
    const end = z.iso.date().parse(url.searchParams.get("end") || dateAgo(0));
    const duration = Date.parse(end) - Date.parse(start) + 86400000;
    if (duration <= 0 || duration > 366 * 86400000)
      throw new HttpError(
        400,
        "Choose an ordered date range of at most 366 days.",
      );
    const previousEnd = new Date(Date.parse(start) - 86400000)
      .toISOString()
      .slice(0, 10);
    const previousStart = new Date(Date.parse(start) - duration)
      .toISOString()
      .slice(0, 10);
    const device = url.searchParams.get("device") || "";
    const country = url.searchParams.get("country") || "";
    const performance = await rows<Record<string, unknown>>(
      env,
      "SELECT * FROM gsc_performance WHERE project_id=? AND date>=? AND date<=? AND (?='' OR device=?) AND (?='' OR country=?) ORDER BY date DESC LIMIT 10000",
      p.id,
      start,
      end,
      device,
      device,
      country,
      country,
    );
    const previousPerformance = await rows<Record<string, unknown>>(
      env,
      "SELECT * FROM gsc_performance WHERE project_id=? AND date>=? AND date<=? AND (?='' OR device=?) AND (?='' OR country=?) ORDER BY date DESC LIMIT 10000",
      p.id,
      previousStart,
      previousEnd,
      device,
      device,
      country,
      country,
    );
    const data = await Promise.all(
      [
        "tracked_keywords",
        "backlinks",
        "seo_issues",
        "crawled_pages",
        "pagespeed_results",
        "project_toxicity_snapshots",
        "audit_runs",
        "backlink_import_batches",
        "page_audit_findings",
      ].map((t) => objects(env, t, p.id)),
    );
    const jobs = await rows(
      env,
      "SELECT id,type,status,progress,last_error,created_at,completed_at FROM background_jobs WHERE project_id=? ORDER BY created_at DESC LIMIT 50",
      p.id,
    );
    return json({
      project: p,
      performance,
      previousPerformance,
      keywords: data[0],
      backlinks: data[1],
      issues: data[2],
      pages: data[3],
      pagespeed: data[4],
      toxicity: data[5],
      audits: data[6],
      imports: data[7],
      findings: data[8],
      jobs,
      range: { start, end },
      truncated:
        performance.length === 10000 || previousPerformance.length === 10000,
    });
  }
  if (action === "keywords" && req.method === "POST") {
    const b = z
      .object({
        keyword: z.string().trim().min(1).max(500),
        targetUrl: z
          .url({ protocol: /^https?$/ })
          .max(2048)
          .optional(),
        location: z.string().max(100).default("All countries"),
        tags: z.array(z.string().max(100)).max(20).default([]),
      })
      .parse(await readBody(req));
    const id = uid();
    const data = {
      ...b,
      id,
      projectId: p.id,
      keyword: b.keyword.toLowerCase(),
      device: "desktop",
      trackingSince: now(),
      createdAt: now(),
    };
    await stmt(
      env,
      "INSERT INTO tracked_keywords VALUES(?,?,?,?,?) ON CONFLICT(project_id,keyword) DO UPDATE SET data=json_set(excluded.data,'$.id',tracked_keywords.id,'$.createdAt',tracked_keywords.created_at)",
      id,
      p.id,
      data.keyword,
      JSON.stringify(data),
      now(),
    ).run();
    return json(data);
  }
  if (action.startsWith("keywords/") && req.method === "PATCH") {
    const id = action.slice(9);
    const old = await stmt(
      env,
      "SELECT data FROM tracked_keywords WHERE id=? AND project_id=?",
      id,
      p.id,
    ).first<{ data: string }>();
    if (!old) throw new HttpError(404, "Tracked keyword not found.");
    const change = z
      .object({
        keyword: z.string().trim().min(1).max(500).optional(),
        targetUrl: z
          .url({ protocol: /^https?$/ })
          .max(2048)
          .optional(),
      })
      .parse(await readBody(req));
    const data = { ...JSON.parse(old.data), ...change };
    data.keyword = data.keyword.toLowerCase();
    if (
      await stmt(
        env,
        "SELECT id FROM tracked_keywords WHERE project_id=? AND keyword=? AND id<>?",
        p.id,
        data.keyword,
        id,
      ).first()
    )
      throw new HttpError(409, "That keyword is already tracked.");
    await stmt(
      env,
      "UPDATE tracked_keywords SET keyword=?,data=? WHERE id=? AND project_id=?",
      data.keyword,
      JSON.stringify(data),
      id,
      p.id,
    ).run();
    return json(data);
  }
  if (action.startsWith("keywords/") && req.method === "DELETE") {
    await stmt(
      env,
      "DELETE FROM tracked_keywords WHERE id=? AND project_id=?",
      action.slice(9),
      p.id,
    ).run();
    return json({ deleted: true });
  }
  if (action === "backlinks/import" && req.method === "POST") {
    await budget(env, user.id, "import", 20);
    const b = z
      .object({
        text: z.string().max(1_000_000),
        filename: z.string().min(1).max(255),
      })
      .parse(await readBody(req));
    const result = await importCsv(env, p.id, b.text, b.filename);
    await enqueue(env, p.id, "toxicity", {});
    return json(result);
  }
  if (action.startsWith("backlinks/") && req.method === "PATCH") {
    const id = action.slice(10);
    const record = await stmt(
      env,
      "SELECT data FROM backlinks WHERE id=? AND project_id=?",
      id,
      p.id,
    ).first<{ data: string }>();
    if (!record) throw new HttpError(404, "Backlink not found.");
    const b = z
      .object({
        reviewed: z.boolean().optional(),
        notes: z.string().max(10000).optional(),
        falsePositive: z.boolean().optional(),
        disavowStatus: z
          .enum(["none", "disavow-link", "disavow-domain", "whitelisted"])
          .optional(),
      })
      .parse(await readBody(req));
    await stmt(
      env,
      "UPDATE backlinks SET data=?,updated_at=? WHERE id=? AND project_id=?",
      JSON.stringify({ ...JSON.parse(record.data), ...b }),
      now(),
      id,
      p.id,
    ).run();
    return json({ saved: true });
  }
  if (action === "issues" && req.method === "POST")
    return json(await saveIssue(env, p.id, user.id, await readBody(req)), 201);
  const issueMatch = action.match(/^issues\/([^/]+)(?:\/(comments|events))?$/);
  if (issueMatch) {
    const id = issueMatch[1];
    const record = await stmt(
      env,
      "SELECT data FROM seo_issues WHERE id=? AND project_id=?",
      id,
      p.id,
    ).first<{ data: string }>();
    if (!record) throw new HttpError(404, "Issue not found.");
    if (!issueMatch[2] && req.method === "PATCH")
      return json(await saveIssue(env, p.id, user.id, await readBody(req), id));
    if (!issueMatch[2] && req.method === "DELETE") {
      if (JSON.parse(record.data).source !== "manual")
        throw new HttpError(
          409,
          "Audit findings should be resolved, not deleted.",
        );
      await stmt(
        env,
        "DELETE FROM seo_issues WHERE id=? AND project_id=?",
        id,
        p.id,
      ).run();
      return json({ deleted: true });
    }
    if (issueMatch[2] === "comments" && req.method === "POST") {
      const b = z
        .object({ body: z.string().trim().min(1).max(10000) })
        .parse(await readBody(req));
      await stmt(
        env,
        "INSERT INTO issue_comments VALUES(?,?,?,?,?)",
        uid(),
        id,
        user.id,
        b.body,
        now(),
      ).run();
      return json({ saved: true });
    }
    if (issueMatch[2] && req.method === "GET")
      return json(
        await rows(
          env,
          `SELECT * FROM ${issueMatch[2] === "comments" ? "issue_comments" : "issue_events"} WHERE issue_id=? ORDER BY created_at DESC LIMIT 100`,
          id,
        ),
      );
  }
  if (action === "jobs" && req.method === "POST") {
    await budget(env, user.id, "job-create", 100);
    const b = z
      .object({
        type: z.enum(["gsc", "crawl", "pagespeed", "toxicity"]),
        url: z.string().max(2048).optional(),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(Number(env.CRAWLER_MAX_PAGES || 25))
          .default(1),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .max(Number(env.CRAWLER_MAX_DEPTH || 3))
          .default(0),
        strategy: z.enum(["mobile", "desktop"]).optional(),
      })
      .parse(await readBody(req));
    if (b.url) validateTarget(b.url, p.domain);
    if (b.type === "gsc" && !p.gsc_property)
      throw new HttpError(409, "Select a Search Console property first.");
    const payload: JobPayload =
      b.type === "gsc"
        ? {
            date: p.last_sync_at ? dateAgo(7) : dateAgo(93),
            endDate: dateAgo(3),
          }
        : b;
    const id = await enqueue(
      env,
      p.id,
      b.type,
      payload,
      b.type + (b.type === "pagespeed" ? ":" + b.url + ":" + b.strategy : ""),
    );
    ctx.waitUntil(runJobs(env, p.id));
    return json({ id, status: "QUEUED" }, 202);
  }
  if (action === "jobs/process" && req.method === "POST") {
    await budget(env, user.id, "job-poll", 5000);
    // Background work after a response is short-lived, so PageSpeed (often 20–40 s) is left to the cron.
    ctx.waitUntil(runJobs(env, p.id, 20000, ["pagespeed"]));
    return json({ accepted: true });
  }
  const cancel = action.match(/^jobs\/([^/]+)\/cancel$/);
  if (cancel && req.method === "POST") {
    const job = await stmt(
      env,
      "UPDATE background_jobs SET status='CANCELLED',completed_at=? WHERE id=? AND project_id=? AND status IN ('QUEUED','RUNNING') RETURNING payload,type",
      now(),
      cancel[1],
      p.id,
    ).first<{ payload: string; type: string }>();
    if (job) {
      const payload = JSON.parse(job.payload) as JobPayload;
      if (payload.auditId)
        await stmt(
          env,
          "UPDATE audit_runs SET data=json_set(data,'$.status','cancelled'),updated_at=? WHERE id=? AND project_id=?",
          now(),
          payload.auditId,
          p.id,
        ).run();
      else if (job.type === "crawl")
        await stmt(
          env,
          "UPDATE audit_runs SET data=json_set(data,'$.status','cancelled'),updated_at=? WHERE project_id=? AND json_extract(data,'$.status') IN ('running','queued')",
          now(),
          p.id,
        ).run();
    }
    return json({ cancelled: !!job });
  }
  throw new HttpError(404, "API action not found.");
}
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    if (!new URL(req.url).pathname.startsWith("/api/"))
      return env.ASSETS.fetch(req);
    try {
      return await api(req, env, ctx);
    } catch (e) {
      if (e instanceof z.ZodError)
        return json(
          {
            error: e.issues
              .map((i) => i.path.join(".") + ": " + i.message)
              .join("; "),
          },
          400,
        );
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      // Never serialize raw provider/SQL errors or token-bearing URLs.
      return json(
        {
          error: "The operation failed. Check server configuration and retry.",
        },
        500,
      );
    }
  },
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(scheduled(env));
  },
};
