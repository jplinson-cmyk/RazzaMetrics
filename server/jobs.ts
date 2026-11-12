import { accessToken } from "./auth";
import { recalculate } from "./backlinks";
import {
  budget,
  digest,
  Env,
  external,
  HttpError,
  now,
  objects,
  rows,
  stmt,
  uid,
} from "./core";
import { crawlPage, safeFetch, validateTarget, analyzeHtml } from "./crawler";
import {parseSitemap,sitemapSeeds,SitemapTask,MAX_SITEMAP_DEPTH,MAX_SITEMAP_DOCUMENTS} from './sitemaps';
import {settings} from './settings';
export interface ProjectRow {
  id: string;
  owner_id: string;
  domain: string;
  url: string;
  name: string;
  gsc_property?: string;
  ga4_property?: string;
  code?: string;
  created_at: string;
  last_sync_at?: string;
}
interface Job {
  id: string;
  project_id: string;
  type: string;
  payload: string;
  attempts: number;
  lease_token: string;
}
export interface JobPayload {
  date?: string;
  initialDate?: string;
  endDate?: string;
  startRow?: number;
  url?: string;
  strategy?: "mobile" | "desktop";
  maxPages?: number;
  maxDepth?: number;
  queue?: { url: string; depth: number }[];
  visited?: string[];
  robots?: string;
  robotsLoaded?: boolean;
  auditId?: string;
  pageErrors?: { url: string; error: string }[];
  sitemapQueue?: SitemapTask[];
  sitemapVisited?: string[];
  sitemapFound?: boolean;
  discoveryWarnings?: string[];
}
export async function enqueue(
  env: Env,
  projectId: string,
  type: string,
  payload: JobPayload,
  dedupe = type,
) {
  const existing = await stmt(
    env,
    "SELECT id FROM background_jobs WHERE project_id=? AND dedupe_key=? AND status IN ('QUEUED','RUNNING')",
    projectId,
    dedupe,
  ).first<{ id: string }>();
  if (existing) return existing.id;
  const id = uid();
  await stmt(
    env,
    "INSERT OR IGNORE INTO background_jobs(id,project_id,type,payload,dedupe_key,created_at) VALUES(?,?,?,?,?,?)",
    id,
    projectId,
    type,
    JSON.stringify(payload),
    dedupe,
    now(),
  ).run();
  return (
    (
      await stmt(
        env,
        "SELECT id FROM background_jobs WHERE project_id=? AND dedupe_key=? AND status IN ('QUEUED','RUNNING')",
        projectId,
        dedupe,
      ).first<{ id: string }>()
    )?.id || id
  );
}
export async function googleJson<T>(
  env: Env,
  owner: string,
  path: string,
  body?: unknown,
): Promise<T> {
  await budget(
    env,
    "global",
    "gsc",
    Number(env.DAILY_GSC_REQUEST_LIMIT || 100),
  );
  const token = await accessToken(env, owner);
  const response = await external(
    "https://www.googleapis.com/webmasters/v3" + path,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  return response.json<T>();
}
export const dateAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
function analyzeSkippedPage(url:string) {
  return {...analyzeHtml('',url),statusCode:0,analysisStatus:'robots-disallowed',findings:[{checkType:'robots_disallowed',severity:'notice' as const,title:'URL excluded by robots.txt',description:'This URL or its redirect destination is disallowed for the crawler. Content was not fetched or assessed.',recommendation:'Review robots rules if this URL should be crawled; otherwise leave it excluded.'}]};
}
async function syncBatch(
  env: Env,
  project: ProjectRow,
  p: JobPayload,
  checkActive: () => Promise<void>,
) {
  if (!project.gsc_property)
    throw new HttpError(409, "Select an authorized Search Console property.");
  p.date ||= dateAgo(93);
  p.endDate ||= dateAgo(3);
  p.startRow ||= 0;
  p.initialDate ||= p.date;
  const result = await googleJson<{
    rows?: {
      keys: string[];
      clicks: number;
      impressions: number;
      position: number;
    }[];
  }>(
    env,
    project.owner_id,
    `/sites/${encodeURIComponent(project.gsc_property)}/searchAnalytics/query`,
    {
      startDate: p.date,
      endDate: p.date,
      dimensions: ["date", "query", "page", "device", "country"],
      rowLimit: 1000,
      startRow: p.startRow,
      dataState: "final",
      type: "web",
    },
  );
  await checkActive();
  const statements = [];
  for (const r of result.rows || []) {
    if (
      r.keys.length !== 5 ||
      ![r.clicks, r.impressions, r.position].every(Number.isFinite)
    )
      throw new HttpError(502, "Google returned invalid measurement data.");
    const [date, keyword, page, device, country] = r.keys;
    const id = await digest(JSON.stringify([project.id, ...r.keys]));
    statements.push(
      stmt(
        env,
        `INSERT INTO gsc_performance VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,keyword,page,date,device,country) DO UPDATE SET clicks=excluded.clicks,impressions=excluded.impressions,position=excluded.position,synced_at=excluded.synced_at`,
        id,
        project.id,
        keyword,
        page,
        date,
        device,
        country,
        r.clicks,
        r.impressions,
        r.position,
        now(),
      ),
    );
  }
  for (let i = 0; i < statements.length; i += 80)
    await env.DB.batch(statements.slice(i, i + 80));
  if (result.rows?.length === 1000) {
    p.startRow += 1000;
    if (p.startRow >= 50000)
      throw new HttpError(
        409,
        "Daily row safety cap reached. Partial measurements retained.",
      );
    return false;
  }
  if (p.date < p.endDate) {
    p.date = new Date(Date.parse(p.date) + 86400000).toISOString().slice(0, 10);
    p.startRow = 0;
    return false;
  }
  await stmt(
    env,
    "UPDATE projects SET last_sync_at=?,updated_at=? WHERE id=?",
    now(),
    now(),
    project.id,
  ).run();
  return true;
}
async function upsertFinding(
  env: Env,
  projectId: string,
  auditId: string,
  url: string,
  finding: {
    checkType: string;
    severity: string;
    title: string;
    description: string;
    evidence?: string;
    recommendation: string;
  },
  cache: Map<string, { id: string; data: string }>,
  pending: D1PreparedStatement[],
) {
  const fingerprint = JSON.stringify([finding.checkType, url]);
  const old = cache.get(fingerprint);
  const oldData = old ? JSON.parse(old.data) : {};
  const id = old?.id || uid();
  const time = now();
  const data = {
    ...oldData,
    id,
    projectId,
    url,
    issueType: finding.checkType,
    ...finding,
    status: oldData.status === "in-progress" ? "in-progress" : "open",
    resolvedAt: undefined,
    source: "audit",
    sourceRef: auditId,
    firstDetectedAt: oldData.firstDetectedAt || time,
    lastDetectedAt: time,
    createdAt: oldData.createdAt || time,
    updatedAt: time,
  };
  cache.set(fingerprint, { id, data: JSON.stringify(data) });
  pending.push(
    ...[
      stmt(
        env,
        "INSERT INTO page_audit_findings VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        await digest(JSON.stringify([auditId, url, finding.checkType])),
        projectId,
        auditId,
        JSON.stringify({ ...finding, url, auditId }),
        time,
      ),
      stmt(
        env,
        "INSERT INTO seo_issues VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,fingerprint) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
        id,
        projectId,
        fingerprint,
        JSON.stringify(data),
        data.createdAt,
        time,
      ),
      stmt(
        env,
        "INSERT INTO issue_events VALUES(?,?,?,?,?)",
        uid(),
        id,
        null,
        JSON.stringify({
          event: old ? "detected-again" : "created-from-audit",
          auditId,
        }),
        time,
      ),
    ],
  );
}
async function crawlBatch(
  env: Env,
  project: ProjectRow,
  p: JobPayload,
  checkActive: () => Promise<void>,
) {
  p.url ||= project.url;
  const existing = await rows<{
    id: string;
    fingerprint: string;
    data: string;
  }>(
    env,
    "SELECT id,fingerprint,data FROM seo_issues WHERE project_id=?",
    project.id,
  );
  const cache = new Map(existing.map((i) => [i.fingerprint, i]));
  const pending: D1PreparedStatement[] = [];
  const saveFinding = (
    url: string,
    finding: Parameters<typeof upsertFinding>[4],
  ) => upsertFinding(env, project.id, p.auditId!, url, finding, cache, pending);
  if (!p.auditId) {
    p.auditId = uid();
    await stmt(
      env,
      "INSERT INTO audit_runs VALUES(?,?,?,?,?)",
      p.auditId,
      project.id,
      JSON.stringify({ id: p.auditId, status: "running", createdAt: now() }),
      now(),
      now(),
    ).run();
    p.queue = [{ url: p.url || project.url, depth: 0 }];
    p.visited = [];
  }
  if (!p.robotsLoaded) {
    const robot = await safeFetch(
      env,
      new URL("/robots.txt", project.url).href,
      project.domain,
    );
    if (
      robot.statusCode !== 404 &&
      robot.statusCode !== 410 &&
      robot.statusCode !== 200
    )
      throw new HttpError(409, "robots.txt unavailable; crawl paused.");
    p.robots = robot.statusCode === 200 ? robot.html : "";
    p.robotsLoaded = true;
    if ((p.maxPages || 1) > 1 && (p.maxDepth || 0)>0) p.sitemapQueue=sitemapSeeds(p.robots,project.url,project.domain);
    p.sitemapVisited ||= [];
  }
  // One discovery document per saved batch bounds requests and supports restart.
  if(p.sitemapQueue?.length && (p.sitemapVisited?.length || 0)<MAX_SITEMAP_DOCUMENTS) {
    const task=p.sitemapQueue.shift()!;
    if(!p.sitemapVisited!.includes(task.url)) {
      try {
        await budget(env,'global','crawl',Number(env.DAILY_CRAWL_PAGE_LIMIT || 100));
        const response=await safeFetch(env,task.url,project.domain);
        if(response.statusCode===429||response.statusCode>=500)throw new HttpError(429,'Sitemap service unavailable; discovery deferred.');
        if(response.statusCode===200) {
          const parsed=parseSitemap(response.html,project.domain,200);
          p.sitemapFound=true;
          for(const url of parsed.pages)if(!p.queue!.some(q=>q.url===url)&&!p.visited!.includes(url)&&p.queue!.length<200)p.queue!.push({url,depth:1});
          if(task.depth<MAX_SITEMAP_DEPTH)for(const url of parsed.sitemaps)if(!p.sitemapVisited!.includes(url)&&!p.sitemapQueue.some(q=>q.url===url)&&p.sitemapQueue.length+p.sitemapVisited!.length<MAX_SITEMAP_DOCUMENTS)p.sitemapQueue.push({url,depth:task.depth+1});
        }
      } catch(e) {
        if(e instanceof HttpError && e.status===429){p.sitemapQueue.unshift(task);throw e;}
        (p.discoveryWarnings ||= []).push(`Sitemap skipped: ${task.url}. Invalid, out of scope, or unavailable.`);
      }
      p.sitemapVisited!.push(task.url);
    }
    await checkActive();
    return false;
  }
  const next = p.queue!.shift();
  if (
    next &&
    !p.visited!.includes(next.url) &&
    p.visited!.length < (p.maxPages || 1)
  ) {
    let page: Awaited<ReturnType<typeof crawlPage>>;
    try {
      page = await crawlPage(env, next.url, project.domain, p.robots || "");
    } catch (e) {
      if(e instanceof HttpError && e.status===403 && e.message.startsWith('robots.txt')) {
        page={...analyzeSkippedPage(next.url),redirectChain:[]};
      } else {p.queue!.unshift(next);throw e;}
    }
    await checkActive();
    p.visited!.push(next.url);
    await stmt(
      env,
      "INSERT OR REPLACE INTO crawled_pages VALUES(?,?,?,?,?,?)",
      await digest(p.auditId + next.url),
      project.id,
      p.auditId,
      next.url,
      JSON.stringify({ ...page, auditId: p.auditId }),
      now(),
    ).run();
    for (const finding of page.findings) await saveFinding(next.url, finding);
    if (next.depth < (p.maxDepth || 0))
      for (const link of page.internalLinks) {
        try {
          const u = validateTarget(link, project.domain).href;
          if (
            !p.visited!.includes(u) &&
            !p.queue!.some((q) => q.url === u) &&
            p.queue!.length < 200
          )
            p.queue!.push({ url: u, depth: next.depth + 1 });
        } catch {
          /* scope restriction */
        }
      }
  }
  const complete = !p.queue!.length || p.visited!.length >= (p.maxPages || 1);
  if (complete) {
    const pages = await rows<{ data: string }>(
      env,
      "SELECT data FROM crawled_pages WHERE audit_id=? AND project_id=?",
      p.auditId,
      project.id,
    );
    const parsed = pages.map(
      (r) =>
        JSON.parse(r.data) as {
          url: string;
          title?: string;
          description?: string;
          statusCode: number;
          internalLinks: string[];
          analysisStatus?: string;
        },
    );
    for (const page of parsed.filter(page=>!page.analysisStatus||page.analysisStatus==='complete')) {
      for (const field of ["title", "description"] as const)
        if (
          page[field] &&
          parsed.filter((other) => (!other.analysisStatus||other.analysisStatus==='complete')&&other[field] === page[field]).length > 1
        )
          await saveFinding(page.url, {
            checkType: "duplicate_" + field,
            severity: "warning",
            title: `Duplicate ${field}`,
            description: `Multiple crawled pages share this ${field}.`,
            evidence: page[field],
            recommendation: `Write a unique ${field} for each distinct page.`,
          });
      const broken = page.internalLinks.filter((link) =>
        parsed.some((other) => other.url === link && other.statusCode >= 400 && (!other.analysisStatus||other.analysisStatus==='http-error')),
      );
      if (broken.length)
        await saveFinding(page.url, {
          checkType: "broken_internal_links",
          severity: "warning",
          title: "Broken internal links",
          description: "Internal targets returned errors in this crawl.",
          evidence: broken.join(", "),
          recommendation: "Fix or remove these links.",
        });
    }
    // Resolve only findings on successfully fetched pages in this completed run.
    const issues = [...cache.values()].map(
      (row) => JSON.parse(row.data) as Record<string, unknown>,
    );
    for (const issue of issues)
      if (
        issue.source === "audit" &&
        issue.sourceRef !== p.auditId &&
        parsed.some(
          (page) => page.url === issue.url && page.statusCode>0 && page.statusCode < 400 && (!page.analysisStatus||page.analysisStatus==='complete'),
        ) &&
        issue.status !== "resolved"
      ) {
        pending.push(
          ...[
            stmt(
              env,
              "UPDATE seo_issues SET data=?,updated_at=? WHERE project_id=? AND id=?",
              JSON.stringify({
                ...issue,
                status: "resolved",
                resolvedAt: now(),
                updatedAt: now(),
              }),
              now(),
              project.id,
              issue.id,
            ),
            stmt(
              env,
              "INSERT INTO issue_events VALUES(?,?,?,?,?)",
              uid(),
              issue.id,
              null,
              JSON.stringify({
                event: "resolved-after-completed-audit",
                auditId: p.auditId,
              }),
              now(),
            ),
          ],
        );
      }
  }
  await checkActive();
  if (pending.length) await env.DB.batch(pending);
  const savedPages=await rows<{data:string}>(env,'SELECT data FROM crawled_pages WHERE audit_id=? AND project_id=?',p.auditId,project.id);
  const coverage=savedPages.map(r=>JSON.parse(r.data) as {statusCode:number;analysisStatus?:string});
  await stmt(
    env,
    "UPDATE audit_runs SET data=?,updated_at=? WHERE id=? AND project_id=?",
    JSON.stringify({
      id: p.auditId,
      status: complete ? "completed" : "running",
      pagesCrawled: p.visited!.length,
      pagesFetched: coverage.filter(page=>page.statusCode>0).length,
      pagesAnalyzed:coverage.filter(page=>!page.analysisStatus||page.analysisStatus==='complete').length,
      pagesSkipped:coverage.filter(page=>page.analysisStatus&&page.analysisStatus!=='complete').length,
      sitemapFound:p.sitemapFound || false,
      sitemapDocuments:p.sitemapVisited?.length || 0,
      discoveryWarnings:p.discoveryWarnings || [],
      robotsFound:!!p.robots,
      scope:{url:p.url,maxPages:p.maxPages||1,maxDepth:p.maxDepth||0},
      completedAt: complete ? now() : undefined,
    }),
    now(),
    p.auditId,
    project.id,
  ).run();
  return complete;
}
async function pageSpeed(
  env: Env,
  project: ProjectRow,
  p: JobPayload,
  checkActive: () => Promise<void>,
) {
  const url = validateTarget(p.url || project.url, project.domain).href;
  const strategy = p.strategy || "mobile";
  const cached = await objects<{
    url: string;
    strategy: string;
    testedAt: string;
  }>(env, "pagespeed_results", project.id);
  if (
    cached.some(
      (r) =>
        r.url === url &&
        r.strategy === strategy &&
        Date.parse(r.testedAt) > Date.now() - 86400000 &&
        // Results saved before Total Blocking Time was recorded are refreshed once.
        "labTbt" in r,
    )
  )
    return true;
  await budget(
    env,
    "global",
    "pagespeed",
    Number(env.DAILY_PAGESPEED_REQUEST_LIMIT || 10),
  );
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "accessibility", "best-practices", "seo"])
    params.append("category", c);
  if (env.GOOGLE_PAGESPEED_API_KEY)
    params.set("key", env.GOOGLE_PAGESPEED_API_KEY);
  const data = await (
    await external(
      "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?" +
        params,
      {},
      // A mobile Lighthouse run regularly takes 20–40 s; 25 s timed out about half of them.
      60000,
    )
  ).json<{
    lighthouseResult?: {
      categories: Record<string, { score: number | null }>;
      audits: Record<string, { numericValue?: number }>;
    };
    loadingExperience?: { metrics?: Record<string, { percentile: number }> };
    originLoadingExperience?: { metrics?: Record<string, { percentile: number }> };
  }>();
  await checkActive();
  if (!data.lighthouseResult)
    throw new HttpError(502, "PageSpeed did not return Lighthouse results.");
  const cats = data.lighthouseResult.categories;
  const audits = data.lighthouseResult.audits;
  // Page-level real-visitor data first; smaller pages often only have the site-wide (origin) figures.
  const pageField = data.loadingExperience?.metrics || {};
  const fieldScope = Object.keys(pageField).length ? "page" : data.originLoadingExperience?.metrics ? "site" : null;
  const field = fieldScope === "site" ? data.originLoadingExperience!.metrics! : pageField;
  const score = (key: string) =>
    typeof cats[key]?.score === "number"
      ? Math.round(cats[key].score! * 100)
      : null;
  const id = uid();
  const result = {
    id,
    projectId: project.id,
    url,
    strategy,
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seoScore: score("seo"),
    lcp:
      field.LARGEST_CONTENTFUL_PAINT_MS?.percentile !== undefined
        ? field.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
        : undefined,
    cls:
      field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined
        ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
        : undefined,
    inp:
      field.INTERACTION_TO_NEXT_PAINT?.percentile !== undefined
        ? field.INTERACTION_TO_NEXT_PAINT.percentile / 1000
        : undefined,
    labLcp:
      audits["largest-contentful-paint"]?.numericValue !== undefined
        ? audits["largest-contentful-paint"].numericValue! / 1000
        : undefined,
    labCls: audits["cumulative-layout-shift"]?.numericValue,
    // Total Blocking Time is the lab stand-in for INP, which needs real visitors.
    labTbt: audits["total-blocking-time"]?.numericValue !== undefined ? audits["total-blocking-time"].numericValue! / 1000 : undefined,
    lighthouseJson: JSON.stringify(data.lighthouseResult),
    testedAt: now(),
    fieldScope,
    fieldSource: fieldScope === "site" ? "CrUX origin-level (site-wide)" : "CrUX URL-level (when available)",
    labSource: "Lighthouse",
  };
  await stmt(
    env,
    "INSERT INTO pagespeed_results VALUES(?,?,?,?)",
    id,
    project.id,
    JSON.stringify(result),
    now(),
  ).run();
  return true;
}
// Quick, user-facing jobs first: a PageSpeed test is one request, an audit is a short crawl,
// and a Search Console backfill can run for many batches without starving the others.
const JOB_PRIORITY = "CASE type WHEN 'pagespeed' THEN 0 WHEN 'crawl' THEN 1 WHEN 'toxicity' THEN 2 ELSE 3 END";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Keep processing job batches until there is no work or the time budget is spent, instead of one batch per call.
 * The budget stays under the ~30 s a Worker may continue after responding. Each batch checkpoints its own
 * progress, so an invocation that is cut short loses nothing.
 */
export async function runJobs(env: Env, projectId?: string, budgetMs = 20000, skipTypes: string[] = []) {
  // Only whitelisted type names reach this SQL fragment.
  const skip = skipTypes.filter((t) => /^[a-z]+$/.test(t)).map((t) => `'${t}'`).join(",");
  const notSkipped = skip ? ` AND type NOT IN (${skip})` : "";
  const started = Date.now();
  for (let round = 0; round < 60 && (round === 0 || Date.now() - started < budgetMs); round++) {
    const outcome = await runOneJob(env, projectId, notSkipped);
    if (outcome === "busy") return; // another invocation holds the single running lease
    if (outcome === "idle") {
      // A crawl waits about a second between pages; wait for it if that fits the budget, otherwise stop.
      const next = await stmt(
        env,
        `SELECT MIN(next_attempt) AS at FROM background_jobs WHERE status='QUEUED' ${projectId ? "AND project_id=?" : ""}${notSkipped}`,
        ...(projectId ? [projectId] : []),
      ).first<{ at: number | null }>();
      const wait = next?.at ? next.at - Date.now() : Infinity;
      if (wait > 1500 || Date.now() - started + wait > budgetMs) return;
      await sleep(Math.max(0, wait));
    }
  }
}

async function runOneJob(env: Env, projectId?: string, notSkipped = ""): Promise<"ran" | "idle" | "busy"> {
  await stmt(
    env,
    "UPDATE background_jobs SET status='FAILED',last_error='Job interrupted repeatedly; retry from the tool.',completed_at=? WHERE status='RUNNING' AND lease_until<? AND attempts>=4",
    now(),
    Date.now(),
  ).run();
  const eligible = await rows<{ id: string }>(
    env,
    `SELECT id FROM background_jobs WHERE (status='QUEUED' OR (status='RUNNING' AND lease_until<?)) AND next_attempt<=? ${projectId ? "AND project_id=?" : ""}${notSkipped} ORDER BY ${JOB_PRIORITY}, created_at LIMIT 1`,
    Date.now(),
    Date.now(),
    ...(projectId ? [projectId] : []),
  );
  if (!eligible.length) return "idle";
  for (const item of eligible) {
    const lease = uid();
    const job = await stmt(
      env,
      "UPDATE background_jobs SET status='RUNNING',attempts=attempts+1,lease_until=?,lease_token=?,started_at=COALESCE(started_at,?) WHERE id=? AND (status='QUEUED' OR (status='RUNNING' AND lease_until<?)) AND NOT EXISTS(SELECT id FROM background_jobs WHERE status='RUNNING' AND lease_until>?) RETURNING *",
      Date.now() + 120000,
      lease,
      now(),
      item.id,
      Date.now(),
      Date.now(),
    ).first<Job>();
    if (!job) return "busy";
    const payload = JSON.parse(job.payload) as JobPayload;
    const checkpoint = JSON.parse(job.payload) as JobPayload;
    const checkActive = async () => {
      if (
        !(await stmt(
          env,
          "SELECT id FROM background_jobs WHERE id=? AND status='RUNNING' AND lease_token=? AND lease_until>?",
          job.id,
          lease,
          Date.now(),
        ).first())
      )
        throw new HttpError(409, "Job cancelled or its lease expired.");
    };
    try {
      const project = await stmt(
        env,
        "SELECT * FROM projects WHERE id=?",
        job.project_id,
      ).first<ProjectRow>();
      if (!project) throw new Error("Project no longer exists.");
      const complete =
        job.type === "gsc"
          ? await syncBatch(env, project, payload, checkActive)
          : job.type === "crawl"
            ? await crawlBatch(env, project, payload, checkActive)
            : job.type === "pagespeed"
              ? await pageSpeed(env, project, payload, checkActive)
              : (await recalculate(env, project.id, checkActive), true);
      await checkActive();
      const progress = payload.visited
        ? Math.round((payload.visited.length / (payload.maxPages || 1)) * 100)
        : payload.date && payload.initialDate && payload.endDate
          ? Math.round(
              (100 *
                (Date.parse(payload.date) - Date.parse(payload.initialDate))) /
                (Date.parse(payload.endDate) -
                  Date.parse(payload.initialDate) +
                  86400000),
            )
          : 0;
      await stmt(
        env,
        "UPDATE background_jobs SET status=?,payload=?,progress=?,lease_until=NULL,lease_token=NULL,attempts=0,last_error=NULL,completed_at=?,next_attempt=? WHERE id=? AND status='RUNNING' AND lease_token=?",
        complete ? "COMPLETED" : "QUEUED",
        JSON.stringify(payload),
        complete ? 100 : Math.min(99, progress),
        complete ? now() : null,
        Date.now() + (job.type === "crawl" ? 1000 : 0),
        job.id,
        lease,
      ).run();
      if (complete)
        await stmt(
          env,
          "INSERT INTO integration_sync_logs VALUES(?,?,?,?)",
          uid(),
          project.id,
          JSON.stringify({
            jobId: job.id,
            type: job.type,
            status: "completed",
          }),
          now(),
        ).run();
    } catch (e) {
      const quota = e instanceof HttpError && e.status === 429;
      const attempts = quota ? Math.max(0, job.attempts - 1) : job.attempts;
      if (job.type === "crawl") {
        payload.queue = checkpoint.queue || [{ url: payload.url!, depth: 0 }];
        payload.visited = checkpoint.visited || [];
      }
      const lastError =
        e instanceof HttpError
          ? e.message
          : "Job failed; check configuration and retry.";
      const retryAt = quota
        ? Date.parse(now().slice(0, 10)) + 86400000
        : Date.now() + Math.min(3600000, 30000 * 2 ** attempts);
      await stmt(
        env,
        "UPDATE background_jobs SET status=?,attempts=?,payload=?,last_error=?,lease_until=NULL,lease_token=NULL,next_attempt=?,completed_at=? WHERE id=? AND status='RUNNING' AND lease_token=?",
        attempts >= 4 && !quota ? "FAILED" : "QUEUED",
        attempts,
        JSON.stringify(payload),
        lastError,
        retryAt,
        attempts >= 4 && !quota ? now() : null,
        job.id,
        lease,
      ).run();
      if (payload.auditId)
        await stmt(
          env,
          "UPDATE audit_runs SET data=json_set(data,'$.status',?,'$.errorMessage',?),updated_at=? WHERE id=? AND EXISTS(SELECT id FROM background_jobs WHERE id=? AND status IN ('QUEUED','FAILED') AND last_error=?)",
          attempts >= 4 && !quota ? "failed" : "queued",
          lastError,
          now(),
          payload.auditId,
          job.id,
          lastError,
        ).run();
    }
  }
  return "ran";
}
export async function scheduled(env: Env) {
  const retention = Number(env.DATA_RETENTION_DAYS || 400);
  if (!Number.isInteger(retention) || retention < 30 || retention > 3650)
    throw new HttpError(
      503,
      "DATA_RETENTION_DAYS must be between 30 and 3650.",
    );
  const cutoff = new Date(Date.now() - retention * 86400000).toISOString();
  await env.DB.batch([
    stmt(
      env,
      "DELETE FROM gsc_performance WHERE id IN (SELECT id FROM gsc_performance WHERE date<? LIMIT 1000)",
      cutoff.slice(0, 10),
    ),
    stmt(
      env,
      "DELETE FROM background_jobs WHERE id IN (SELECT id FROM background_jobs WHERE created_at<? AND status IN ('COMPLETED','CANCELLED','FAILED') LIMIT 100)",
      cutoff,
    ),
    stmt(
      env,
      "DELETE FROM integration_sync_logs WHERE id IN (SELECT id FROM integration_sync_logs WHERE created_at<? LIMIT 100)",
      cutoff,
    ),
    stmt(env, "DELETE FROM sessions WHERE expires_at<?", Date.now()),
    stmt(env, "DELETE FROM oauth_states WHERE expires_at<?", Date.now()),
  ]);
  const projects = await rows<ProjectRow>(
    env,
    "SELECT * FROM projects WHERE status='active' AND gsc_property IS NOT NULL AND (last_sync_at IS NULL OR last_sync_at<?) LIMIT 5",
    new Date(Date.now() - 86400000).toISOString(),
  );
  for (const p of projects)
    await enqueue(env, p.id, "gsc", {
      date: p.last_sync_at ? dateAgo(7) : dateAgo(93),
      endDate: dateAgo(3),
    });
  // Cron runs may take minutes of wall time, so PageSpeed (often 20–40 s) runs here.
  await runJobs(env, undefined, 50000);
}
