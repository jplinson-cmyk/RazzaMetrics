import { aggregate, type PerformanceRow } from "./measurements";

export interface DayPoint {
  date: string;
  clicks: number;
  impressions: number;
  /** Distinct queries with at least one impression that day. */
  keywords: number;
}

/** One point per calendar day from start to end; days without rows stay NaN so charts draw gaps. */
export function dailySeries(rows: PerformanceRow[], start: string, end: string): DayPoint[] {
  const byDate = new Map<string, PerformanceRow[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  const out: DayPoint[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end) && out.length < 400; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const day = byDate.get(date);
    out.push(
      day
        ? { date, ...pick(aggregate(day)), keywords: new Set(day.filter((r) => r.impressions > 0).map((r) => r.keyword)).size }
        : { date, clicks: NaN, impressions: NaN, keywords: NaN },
    );
  }
  return out;
}
const pick = (a: ReturnType<typeof aggregate>) => ({ clicks: a.clicks, impressions: a.impressions });

/** 12500 -> "12.5K", 1200000 -> "1.2M". */
export function abbreviate(n: number): string {
  if (!Number.isFinite(n)) return "No Data";
  const abs = Math.abs(n);
  const [div, unit] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
  const v = n / div;
  return (unit ? v.toFixed(Math.abs(v) < 100 ? 1 : 0).replace(/\.0$/, "") : String(Math.round(v * 10) / 10)) + unit;
}

/** Percentage change; NaN when there is no previous value to compare against. */
export const delta = (current: number, previous: number) =>
  Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : NaN;

export const POSITION_BUCKETS = [
  { label: "Top 3", min: 0, max: 3.5 },
  { label: "4–10", min: 3.5, max: 10.5 },
  { label: "11–20", min: 10.5, max: 20.5 },
  { label: "21–50", min: 20.5, max: 50.5 },
  { label: "51–100", min: 50.5, max: 100.5 },
] as const;

export function positionDistribution(positions: number[]) {
  const valid = positions.filter((p) => Number.isFinite(p) && p > 0 && p <= 100.5);
  return POSITION_BUCKETS.map((b) => {
    const count = valid.filter((p) => p >= b.min && p < b.max).length;
    return { label: b.label, count, share: valid.length ? (count / valid.length) * 100 : 0 };
  });
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  share: number;
  position: number;
  topKeyword: string;
  keywords: number;
  previousClicks: number;
}

export function topPages(rows: PerformanceRow[], previous: PerformanceRow[]): PageRow[] {
  const group = (list: PerformanceRow[]) => {
    const m = new Map<string, PerformanceRow[]>();
    for (const r of list) if (r.page) m.set(r.page, [...(m.get(r.page) || []), r]);
    return m;
  };
  const now = group(rows);
  const before = group(previous);
  const total = aggregate(rows).clicks;
  return [...now].map(([page, list]) => {
    const a = aggregate(list);
    const byKeyword = new Map<string, number>();
    for (const r of list) byKeyword.set(r.keyword, (byKeyword.get(r.keyword) || 0) + r.clicks + r.impressions / 1e6);
    const topKeyword = [...byKeyword].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
    const prev = before.get(page);
    return {
      page,
      clicks: a.clicks,
      impressions: a.impressions,
      share: total ? (a.clicks / total) * 100 : 0,
      position: a.position,
      topKeyword,
      keywords: byKeyword.size,
      previousClicks: prev ? aggregate(prev).clicks : NaN,
    };
  }).sort((x, y) => y.clicks - x.clicks || y.impressions - x.impressions);
}

/** URL path for display: "https://a.com/blog/x?y" -> "/blog/x?y". */
export function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
}

interface LinkSeen { sourceDomain?: string; firstSeen: string; lastSeen: string }

/**
 * New: referring domains first seen inside the period.
 * Lost: domains whose every link was last seen inside the period and before the newest last-seen date in the
 * data. "Last seen" can be no later than the day the CSV was exported, so links still live at export are not lost.
 */
export function backlinkVelocity(links: LinkSeen[], start: string, end: string) {
  const domains = new Map<string, { first: string; last: string }>();
  for (const l of links) {
    const d = l.sourceDomain;
    if (!d) continue;
    const cur = domains.get(d);
    domains.set(d, {
      first: !cur || (l.firstSeen && l.firstSeen < cur.first) ? l.firstSeen || cur?.first || "" : cur.first,
      last: !cur || l.lastSeen > cur.last ? l.lastSeen || cur?.last || "" : cur.last,
    });
  }
  const day = (s: string) => s.slice(0, 10);
  const asOf = [...domains.values()].reduce((m, s) => (s.last && day(s.last) > m ? day(s.last) : m), "");
  const cutoff = asOf && asOf < end ? asOf : end;
  const gained: string[] = [];
  const lost: string[] = [];
  for (const [d, s] of domains) {
    if (s.first && day(s.first) >= start && day(s.first) <= end) gained.push(d);
    if (s.last && day(s.last) >= start && day(s.last) < cutoff) lost.push(d);
  }
  const dated = [...domains.values()].some((s) => s.first || s.last);
  return { gained: gained.sort(), lost: lost.sort(), total: domains.size, dated };
}

/** Referring domains known on or before a date, for the KPI delta and sparkline. */
export function domainsKnownBy(links: LinkSeen[], date: string) {
  return new Set(links.filter((l) => l.sourceDomain && (!l.firstSeen || l.firstSeen.slice(0, 10) <= date)).map((l) => l.sourceDomain)).size;
}

/** Clicks and impressions grouped by device or country, largest share first. */
export function shareBy(rows: PerformanceRow[], key: "device" | "country") {
  const groups = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rows) {
    const k = (r[key] || "unknown").toLowerCase();
    const g = groups.get(k) ?? groups.set(k, { clicks: 0, impressions: 0 }).get(k)!;
    g.clicks += r.clicks;
    g.impressions += r.impressions;
  }
  const total = [...groups.values()].reduce((n, g) => n + g.clicks, 0);
  return [...groups]
    .map(([name, g]) => ({ name, ...g, share: total ? (g.clicks / total) * 100 : 0 }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

interface Ranked { keyword: string; position: number; previousPosition: number }

/** Biggest position gains and drops between periods. Change is positions gained (positive = moved up). */
export function movers<T extends Ranked>(keywords: T[], n = 5) {
  const moved = keywords
    .filter((k) => Number.isFinite(k.position) && Number.isFinite(k.previousPosition))
    .map((k) => ({ ...k, change: k.previousPosition - k.position }))
    .filter((k) => Math.abs(k.change) >= 0.05);
  return {
    gainers: moved.filter((k) => k.change > 0).sort((a, b) => b.change - a.change).slice(0, n),
    losers: moved.filter((k) => k.change < 0).sort((a, b) => a.change - b.change).slice(0, n),
  };
}

/** Count items into named groups, largest first, with each group's share of the total. */
export function countBy<T>(items: T[], name: (item: T) => string) {
  const m = new Map<string, number>();
  for (const it of items) m.set(name(it), (m.get(name(it)) || 0) + 1);
  return [...m].map(([n, value]) => ({ name: n, value, share: items.length ? (value / items.length) * 100 : 0 })).sort((a, b) => b.value - a.value);
}

const DAY_MS = 86400000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * New and lost referring domains per week for the `weeks` weeks ending at the data's newest last-seen date.
 * Lost follows the same rule as backlinkVelocity: last seen before that newest date.
 */
export function weeklyVelocity(links: LinkSeen[], weeks = 12) {
  const domains = new Map<string, { first: string; last: string }>();
  for (const l of links) {
    if (!l.sourceDomain) continue;
    const f = l.firstSeen?.slice(0, 10) || "", s = l.lastSeen?.slice(0, 10) || "";
    const cur = domains.get(l.sourceDomain);
    domains.set(l.sourceDomain, {
      first: !cur ? f : f && (!cur.first || f < cur.first) ? f : cur.first,
      last: !cur ? s : s > cur.last ? s : cur.last,
    });
  }
  const asOf = [...domains.values()].reduce((m, d) => (d.last > m ? d.last : m), "");
  if (!asOf) return [];
  const end = Date.parse(asOf);
  return Array.from({ length: weeks }, (_, i) => {
    const from = isoDay(end - (weeks - i) * 7 * DAY_MS + DAY_MS);
    const to = isoDay(end - (weeks - 1 - i) * 7 * DAY_MS);
    let gained = 0, lost = 0;
    for (const d of domains.values()) {
      if (d.first && d.first >= from && d.first <= to) gained++;
      if (d.last && d.last >= from && d.last <= to && d.last < asOf) lost++;
    }
    return { from, to, gained, lost };
  });
}

/** Findings per severity for each completed audit, oldest first, so the bars read left to right as time. */
export function auditSeverity(
  audits: { id: string; status: string; completedAt?: string }[],
  findings: { auditId: string; severity: string }[],
  n = 8,
) {
  return audits
    .filter((a) => a.status === "completed" && a.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
    .slice(-n)
    .map((a) => {
      const mine = findings.filter((f) => f.auditId === a.id);
      const count = (s: string) => mine.filter((f) => f.severity === s).length;
      return { id: a.id, date: a.completedAt!.slice(0, 10), error: count("error"), warning: count("warning"), notice: count("notice") };
    });
}

/** Google's Core Web Vitals thresholds (LCP and INP in seconds, CLS unitless). */
const VITALS = { lcp: [2.5, 4], inp: [0.2, 0.5], cls: [0.1, 0.25], tbt: [0.2, 0.6] } as const;
export function vitalRating(metric: keyof typeof VITALS, value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "none" as const;
  const [good, poor] = VITALS[metric];
  return value <= good ? ("good" as const) : value <= poor ? ("improve" as const) : ("poor" as const);
}
