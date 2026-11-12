import { accessToken } from "./auth";
import { budget, Env, HttpError } from "./core";

/** GA4 calls with the owner's Google token. A token from before Analytics was added gets a clear reconnect message. */
async function ga4Json<T>(env: Env, owner: string, url: string, body?: unknown): Promise<T> {
  await budget(env, "global", "ga4", Number(env.DAILY_GA4_REQUEST_LIMIT || 500));
  const token = await accessToken(env, owner);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403)
    throw new HttpError(
      403,
      "Google Analytics access was not granted. Use Connect / reconnect Google and allow Analytics, and make sure the Google Analytics Data and Admin APIs are enabled in Google Cloud.",
    );
  if (!response.ok)
    throw new HttpError(response.status === 429 ? 429 : 502, `Google Analytics returned HTTP ${response.status}.`);
  return response.json<T>();
}

export interface Ga4Property {
  property: string;
  displayName: string;
  account: string;
}

export async function ga4Properties(env: Env, owner: string): Promise<Ga4Property[]> {
  const data = await ga4Json<{
    accountSummaries?: { displayName?: string; propertySummaries?: { property: string; displayName?: string }[] }[];
  }>(env, owner, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
  return (data.accountSummaries || []).flatMap((a) =>
    (a.propertySummaries || []).map((p) => ({ property: p.property, displayName: p.displayName || p.property, account: a.displayName || "" })),
  );
}

const METRICS = ["sessions", "totalUsers", "keyEvents", "engagementRate"] as const;
type Totals = Record<(typeof METRICS)[number], number>;

/**
 * One month against another: site totals for both ranges and the top landing pages for the first.
 * keyEvents is GA4's current name for conversions.
 */
export async function ga4MonthReport(
  env: Env,
  owner: string,
  property: string,
  range: { start: string; end: string },
  previous: { start: string; end: string },
) {
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`;
  type Report = { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[] };
  const toTotals = (values: { value: string }[] | undefined): Totals =>
    Object.fromEntries(METRICS.map((m, i) => [m, Number(values?.[i]?.value ?? 0)])) as Totals;
  const [totals, pages] = await Promise.all([
    ga4Json<Report>(env, owner, endpoint, {
      dateRanges: [
        { startDate: range.start, endDate: range.end, name: "current" },
        { startDate: previous.start, endDate: previous.end, name: "previous" },
      ],
      metrics: METRICS.map((name) => ({ name })),
    }),
    ga4Json<Report>(env, owner, endpoint, {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "keyEvents" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
  ]);
  // With two named date ranges GA4 adds a dateRange dimension to each row.
  const byRange = (name: string) => totals.rows?.find((r) => r.dimensionValues?.some((d) => d.value === name))?.metricValues;
  return {
    current: toTotals(byRange("current")),
    previous: toTotals(byRange("previous")),
    landingPages: (pages.rows || []).map((r) => ({
      page: r.dimensionValues?.[0]?.value || "(not set)",
      sessions: Number(r.metricValues[0]?.value ?? 0),
      keyEvents: Number(r.metricValues[1]?.value ?? 0),
    })),
  };
}

/** Hostname without a leading "www.", so www and bare domains count as the same site. */
const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Does a Search Console property cover this project domain? Domain properties (sc-domain:) cover
 * every subdomain; URL-prefix properties must be the same host, with or without www.
 */
export function gscPropertyMatches(domain: string, property: string) {
  if (property.startsWith("sc-domain:")) {
    const root = bare(property.slice(10));
    const d = bare(domain);
    return d === root || d.endsWith("." + root);
  }
  try {
    return bare(new URL(property).hostname) === bare(domain);
  } catch {
    return false;
  }
}

/**
 * Best effort: link the verified Search Console property and the GA4 property whose web stream points at
 * this domain, using the owner's Google connection. Missing connections or permissions are skipped, never
 * thrown, so adding a site always succeeds. Returns what was newly linked.
 */
export async function autoLinkGoogle(
  env: Env,
  project: { id: string; owner_id: string; domain: string; gsc_property?: string | null; ga4_property?: string | null },
  googleSites: () => Promise<{ siteUrl: string; permissionLevel: string }[]>,
) {
  const linked: { gscProperty?: string; ga4Property?: string } = {};
  if (!project.gsc_property) {
    try {
      const sites = (await googleSites()).filter((s) => s.permissionLevel !== "siteUnverifiedUser" && gscPropertyMatches(project.domain, s.siteUrl));
      // A domain property covers http/https and every subdomain, so prefer it, then https, then anything else.
      const rank = (u: string) => (u.startsWith("sc-domain:") ? 0 : u.startsWith("https://") ? 1 : 2);
      linked.gscProperty = sites.sort((a, b) => rank(a.siteUrl) - rank(b.siteUrl))[0]?.siteUrl;
    } catch {
      /* not connected, or Search Console permission missing */
    }
  }
  if (!project.ga4_property) {
    try {
      for (const p of (await ga4Properties(env, project.owner_id)).slice(0, 50)) {
        const streams = await ga4Json<{ dataStreams?: { webStreamData?: { defaultUri?: string } }[] }>(
          env,
          project.owner_id,
          `https://analyticsadmin.googleapis.com/v1beta/${p.property}/dataStreams`,
        );
        const match = (streams.dataStreams || []).some((s) => {
          try {
            return !!s.webStreamData?.defaultUri && bare(new URL(s.webStreamData.defaultUri).hostname) === bare(project.domain);
          } catch {
            return false;
          }
        });
        if (match) {
          linked.ga4Property = p.property;
          break;
        }
      }
    } catch {
      /* not connected, Analytics permission missing, or the Admin API is not enabled */
    }
  }
  if (linked.gscProperty || linked.ga4Property)
    await env.DB.prepare(
      "UPDATE projects SET gsc_property=COALESCE(gsc_property,?), ga4_property=COALESCE(ga4_property,?), updated_at=? WHERE id=?",
    )
      .bind(linked.gscProperty ?? null, linked.ga4Property ?? null, new Date().toISOString(), project.id)
      .run();
  return linked;
}
