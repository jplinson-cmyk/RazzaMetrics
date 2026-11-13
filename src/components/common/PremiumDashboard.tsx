import React, { useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { aggregate, display } from "../../services/measurements";
import {
  abbreviate,
  authorityEstimate,
  backlinkVelocity,
  dailySeries,
  delta,
  domainsKnownBy,
  positionDistribution,
  shareBy,
  topPages,
  urlPath,
  type LinkSeen,
} from "../../services/explorer";
import type { ActiveTab } from "../layout/Sidebar";
import { DeltaBadge, SegmentedTabs, Skeleton, Sparkline, Truncate, WidgetState } from "../explorer/ui";
import { AreaGradient, curve, Donut, HBars } from "../explorer/charts";
import { MonthFilter, recentMonths, useSearchRows } from "../explorer/MonthFilter";
import type { PerformanceRow } from "../../services/measurements";

/** Daily points for a range and for the same-length range before it. */
function daySeries(rows: PerformanceRow[], previous: PerformanceRow[], start: string, end: string) {
  const length = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  return {
    days: dailySeries(rows, start, end),
    prevDays: dailySeries(previous, iso(Date.parse(start) - length * DAY), iso(Date.parse(start) - DAY)),
  };
}

/** Average position per keyword, impression-weighted, from raw rows. */
function keywordPositions(rows: PerformanceRow[]) {
  const by = new Map<string, PerformanceRow[]>();
  for (const r of rows) (by.get(r.keyword) ?? by.set(r.keyword, []).get(r.keyword)!).push(r);
  return [...by.values()].map((g) => aggregate(g).position);
}

/** Loading or error state while a chart's own month is fetched. */
function monthState(src: { loading: boolean; error: string }) {
  if (src.error) return <WidgetState kind="error" title="This month could not load" body={src.error} />;
  if (src.loading) return <p className="chart-loading" role="status">Loading month…</p>;
  return null;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A rounded axis maximum and its four ticks. */
function axis(max: number, whole = false) {
  if (!(max > 0)) return { top: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  // Counts get whole-number ticks.
  if (whole) step = Math.max(1, Math.ceil(step));
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

export const PremiumDashboard: React.FC<{
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenWeeklyReport: () => void;
  onOpenSiteManager?: () => void;
}> = ({ onNavigateTab }) => {
  const { snapshot, currentProject, organicKeywords, backlinks, filters, refreshing, error, reload } = useProject();

  const model = useMemo(() => {
    if (!snapshot) return null;
    const length = Math.round((Date.parse(filters.end) - Date.parse(filters.start)) / DAY) + 1;
    const prevEnd = iso(Date.parse(filters.start) - DAY);
    const days = dailySeries(snapshot.performance, filters.start, filters.end);
    const cur = aggregate(snapshot.performance);
    const prev = aggregate(snapshot.previousPerformance);
    const queries = (rows: typeof snapshot.performance) => new Set(rows.filter((r) => r.impressions > 0).map((r) => r.keyword)).size;
    const linkDates = backlinks.map((b) => ({ sourceDomain: b.sourceDomain, firstSeen: b.firstSeen, lastSeen: b.lastSeen }));
    const domainsNow = domainsKnownBy(linkDates, filters.end);
    const domainsBefore = domainsKnownBy(linkDates, prevEnd);
    const samples = Array.from({ length: 12 }, (_, i) => iso(Date.parse(filters.start) + (i * (length - 1) * DAY) / 11));
    return {
      days,
      hasSearch: snapshot.performance.length > 0,
      hasPrevious: snapshot.previousPerformance.length > 0,
      cur,
      prev,
      queriesNow: queries(snapshot.performance),
      queriesBefore: queries(snapshot.previousPerformance),
      domainsNow,
      domainsBefore,
      domainSpark: linkDates.some((l) => l.firstSeen) ? samples.map((d) => domainsKnownBy(linkDates, d)) : [],
      linkDates,
    };
  }, [snapshot, filters, backlinks]);

  if (!model) {
    return error ? (
      <div className="explorer" role="region" aria-label="Project analytics">
        <section className="card span-12">
          <WidgetState kind="error" title="Analytics could not load" body={error} onRetry={() => void reload()} />
        </section>
      </div>
    ) : (
      <OverviewSkeleton />
    );
  }

  const kpis = [
    {
      label: "Authority Score",
      value: model.domainsNow ? String(authorityEstimate(model.domainsNow)) : "No Data",
      empty: !model.domainsNow,
      note: model.domainsNow
        ? `Estimate from ${model.domainsNow.toLocaleString()} referring domains`
        : "Import links from Bing or a backlink CSV on Backlink Profile.",
      change: NaN,
      spark: [] as number[],
      tab: "backlinks" as ActiveTab,
    },
    {
      label: "Organic Traffic",
      value: model.hasSearch ? abbreviate(model.cur.clicks) : "No Data",
      empty: !model.hasSearch,
      note: "Search Console clicks",
      change: model.hasPrevious ? delta(model.cur.clicks, model.prev.clicks) : NaN,
      spark: model.days.map((d) => d.clicks),
      tab: "organic" as ActiveTab,
    },
    {
      label: "Organic Keywords",
      value: model.hasSearch ? abbreviate(model.queriesNow) : "No Data",
      empty: !model.hasSearch,
      note: "Queries with impressions",
      change: model.hasPrevious ? delta(model.queriesNow, model.queriesBefore) : NaN,
      spark: model.days.map((d) => d.keywords),
      tab: "organic" as ActiveTab,
    },
    {
      label: "Referring Domains",
      value: model.domainsNow || backlinks.length ? abbreviate(model.domainsNow) : "No Data",
      empty: !backlinks.length,
      note: "From imported backlinks",
      change: model.domainSpark.length ? delta(model.domainsNow, model.domainsBefore) : NaN,
      spark: model.domainSpark,
      tab: "backlinks" as ActiveTab,
    },
    {
      label: "Site Health",
      value: Number.isFinite(currentProject.healthScore) ? `${currentProject.healthScore}%` : "No Data",
      empty: !Number.isFinite(currentProject.healthScore),
      note: "Pages without critical findings",
      change: NaN,
      spark: [] as number[],
      tab: "onpage" as ActiveTab,
    },
  ];

  return (
    <div className={`explorer ${refreshing ? "is-refreshing" : ""}`} role="region" aria-label="Project analytics">
      <section className="kpi-strip span-12" aria-label="Key metrics">
        {kpis.map((k) => (
          <button type="button" key={k.label} className="kpi" onClick={() => onNavigateTab(k.tab)} title={k.note}>
            <span className="kpi-label">{k.label}</span>
            <span className={`kpi-value ${k.empty ? "kpi-value--empty" : ""}`}>{k.value}</span>
            <span className="kpi-foot">
              {k.empty || !Number.isFinite(k.change) ? <span className="kpi-note">{k.note}</span> : <DeltaBadge value={k.change} />}
              <Sparkline values={k.spark} label={`${k.label} trend`} />
            </span>
          </button>
        ))}
      </section>

      <TrendCard />

      <DistributionCard />

      <BreakdownCard backlinks={model.linkDates} onNavigate={onNavigateTab} />

      <AudienceCards device={filters.device} country={filters.country} />
    </div>
  );
};

function TrendCard() {
  const [month, setMonth] = useState("");
  const src = useSearchRows(month);
  const { days, prevDays } = useMemo(() => daySeries(src.rows, src.previous, src.start, src.end), [src.rows, src.previous, src.start, src.end]);
  const hasSearch = src.rows.length > 0;
  const [metric, setMetric] = useState<"clicks" | "value" | "impressions">("clicks");
  const [show, setShow] = useState({ main: true, footprint: true });
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 260, L = 48, R = 48, T = 14, B = 30;
  const plotW = W - L - R, plotH = H - T - B;
  const key = metric === "impressions" ? "impressions" : "clicks";
  const mainLabel = metric === "impressions" ? "Impressions" : "Organic Traffic";
  const left = axis(Math.max(0, ...days.map((d) => d[key]).filter(Number.isFinite)));
  const right = axis(Math.max(0, ...days.map((d) => d.keywords).filter(Number.isFinite)), true);
  const x = (i: number) => L + (days.length > 1 ? (i / (days.length - 1)) * plotW : plotW / 2);
  const y = (v: number, top: number) => T + plotH - (v / top) * plotH;
  // Unbroken runs of days with a value; a gap in the data stays a gap in the line.
  const runs = (vals: number[]) => {
    const out: number[][] = [];
    vals.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      if (i > 0 && Number.isFinite(vals[i - 1])) out[out.length - 1].push(i);
      else out.push([i]);
    });
    return out;
  };
  const line = (vals: number[], top: number) => runs(vals).map((r) => curve(r.map((i) => [x(i), y(vals[i], top)]))).join(" ");
  const mainVals = days.map((d) => d[key]);
  const area = runs(mainVals).filter((r) => r.length > 1)
    .map((r) => `${curve(r.map((i) => [x(i), y(mainVals[i], left.top)]))} L${x(r[r.length - 1]).toFixed(1)} ${T + plotH} L${x(r[0]).toFixed(1)} ${T + plotH} Z`)
    .join(" ");
  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / plotW) * (days.length - 1))));
  };
  const h = hover === null ? null : days[hover];
  const p = hover === null ? null : prevDays[hover];

  return (
    <section className="card span-12" aria-labelledby="trend-title">
      <header className="card-head">
        <h2 id="trend-title" className="visually-hidden">Search trend</h2>
        <SegmentedTabs
          label="Trend metric"
          variant="underline"
          idBase="trend"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "clicks", label: "Organic Traffic" },
            { value: "value", label: "Traffic Value" },
            { value: "impressions", label: "Impressions" },
          ]}
        />
        {metric !== "value" && hasSearch && (
          <div className="legend" role="group" aria-label="Series">
            <button type="button" className="legend-item" aria-pressed={show.main} onClick={() => setShow((s) => ({ ...s, main: !s.main }))}>
              <span className="swatch swatch--main" aria-hidden="true" /> {mainLabel}
            </button>
            <button type="button" className="legend-item" aria-pressed={show.footprint} onClick={() => setShow((s) => ({ ...s, footprint: !s.footprint }))}>
              <span className="swatch swatch--alt" aria-hidden="true" /> Keyword Footprint
            </button>
          </div>
        )}
        <MonthFilter value={month} onChange={setMonth} months={recentMonths()} />
      </header>
      <div id="trend-panel" role="tabpanel" aria-labelledby={`trend-tab-${metric}`} className="chart-body">
        {monthState(src) ?? (metric === "value" ? (
          <WidgetState kind="empty" title="Traffic value needs cost-per-click data" body="This project stores Search Console clicks and impressions, not CPC, so a value would have to be invented. Connect a CPC source to fill this view." />
        ) : !hasSearch ? (
          <WidgetState kind="empty" title="No search measurements in this period" body="Select a Search Console property in the top bar, sync it, or widen the timeframe." />
        ) : !show.main && !show.footprint ? (
          <WidgetState kind="empty" title="Both series are hidden" body="Turn a series back on in the legend above the chart." />
        ) : (
          <div className="chart-frame">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="trend-svg"
              role="img"
              aria-label={`${mainLabel} and keyword footprint per day. Use the arrow keys to read each day.`}
              tabIndex={0}
              onMouseMove={(e) => setHover(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                setHover((i) => Math.max(0, Math.min(days.length - 1, (i ?? (e.key === "ArrowLeft" ? days.length : -1)) + (e.key === "ArrowLeft" ? -1 : 1))));
              }}
            >
              {left.ticks.map((t) => (
                <g key={t}>
                  <line className="grid" x1={L} x2={W - R} y1={y(t, left.top)} y2={y(t, left.top)} />
                  {show.main && <text className="tick" x={L - 8} y={y(t, left.top) + 4} textAnchor="end">{abbreviate(t)}</text>}
                </g>
              ))}
              {show.footprint && right.ticks.map((t) => (
                <text key={t} className="tick tick--alt" x={W - R + 8} y={y(t, right.top) + 4}>{abbreviate(t)}</text>
              ))}
              {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i, n) => (
                <text key={n} className="tick" x={x(i)} y={H - 8} textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}>
                  {days[i]?.date.slice(5)}
                </text>
              ))}
              <AreaGradient id="trend-area" />
              {show.main && <path className="series-area" fill="url(#trend-area)" d={area} />}
              {show.main && <path className="series-main" d={line(mainVals, left.top)} />}
              {show.footprint && <path className="series-alt" d={line(days.map((d) => d.keywords), right.top)} />}
              {h && (
                <g>
                  <line className="crosshair" x1={x(hover!)} x2={x(hover!)} y1={T} y2={T + plotH} />
                  {show.main && Number.isFinite(h[key]) && <circle className="dot-main" cx={x(hover!)} cy={y(h[key], left.top)} r="4" />}
                  {show.footprint && Number.isFinite(h.keywords) && <circle className="dot-alt" cx={x(hover!)} cy={y(h.keywords, right.top)} r="4" />}
                </g>
              )}
            </svg>
            {h && (
              <div className="chart-tip" style={{ left: `${(x(hover!) / W) * 100}%` }} role="status">
                <strong>{h.date}</strong>
                {show.main && (
                  <span><i className="swatch swatch--main" /> {mainLabel} <b>{display(h[key], 0)}</b><em>prev. {display(p?.[key], 0)}</em></span>
                )}
                {show.footprint && (
                  <span><i className="swatch swatch--alt" /> Keyword Footprint <b>{display(h.keywords, 0)}</b><em>prev. {display(p?.keywords, 0)}</em></span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributionCard() {
  const { organicKeywords } = useProject();
  const [month, setMonth] = useState("");
  const src = useSearchRows(month);
  const positions = useMemo(
    () => (month ? keywordPositions(src.rows) : organicKeywords.map((k) => k.position)),
    [month, src.rows, organicKeywords],
  );
  return (
    <section className="card span-6" aria-labelledby="dist-title">
      <header className="card-head">
        <h2 id="dist-title">Keyword position distribution</h2>
        <span className="card-meta">{positions.length.toLocaleString()} keywords</span>
        <MonthFilter value={month} onChange={setMonth} months={recentMonths()} />
      </header>
      {monthState(src) ?? (positions.length ? <Distribution buckets={positionDistribution(positions)} /> : (
        <WidgetState kind="empty" title="No ranking keywords in this period" body="Positions come from Search Console. Pick another month or sync the property." />
      ))}
    </section>
  );
}

function Distribution({ buckets }: { buckets: { label: string; count: number; share: number }[] }) {
  return (
    <div className="dist">
      <div className="dist-bar" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.count}`).join(", ")}>
        {buckets.map((b, i) => b.count > 0 && (
          <span key={b.label} className={`dist-seg pos-${i + 1}`} style={{ flexGrow: b.count }} title={`${b.label}: ${b.count} (${display(b.share)}%)`} />
        ))}
      </div>
      <table className="dist-table">
        <thead>
          <tr><th scope="col">Position</th><th scope="col" className="num">Keywords</th><th scope="col" className="num">Share</th></tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={b.label}>
              <th scope="row"><span className={`swatch pos-${i + 1}`} aria-hidden="true" /> {b.label}</th>
              <td className="num">{b.count.toLocaleString()}</td>
              <td className="num">{display(b.share)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownCard({
  backlinks,
  onNavigate,
}: {
  backlinks: LinkSeen[];
  onNavigate: (tab: ActiveTab) => void;
}) {
  const [tab, setTab] = useState<"pages" | "velocity">("pages");
  const [month, setMonth] = useState("");
  const src = useSearchRows(month);
  const pages = useMemo(() => topPages(src.rows, src.previous), [src.rows, src.previous]);
  const velocity = useMemo(() => backlinkVelocity(backlinks, src.start, src.end), [backlinks, src.start, src.end]);
  const hasLinks = backlinks.length > 0;
  return (
    <section className="card span-6" aria-labelledby="breakdown-title">
      <header className="card-head">
        <h2 id="breakdown-title" className="visually-hidden">Pages and links</h2>
        <SegmentedTabs
          label="Breakdown"
          variant="underline"
          idBase="breakdown"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pages", label: "Top Organic Pages" },
            { value: "velocity", label: "Backlink Velocity" },
          ]}
        />
        <button type="button" className="card-link" onClick={() => onNavigate(tab === "pages" ? "pages" : "backlinks")}>
          View full report →
        </button>
        <MonthFilter value={month} onChange={setMonth} months={recentMonths()} />
      </header>
      <div id="breakdown-panel" role="tabpanel" aria-labelledby={`breakdown-tab-${tab}`}>
        {tab === "pages" ? (
          monthState(src) ?? (pages.length ? (
            <div className="table-scroll">
            <table className="data-table data-table--full">
              <thead>
                <tr><th scope="col">Page</th><th scope="col">Traffic share</th><th scope="col">Top keyword</th><th scope="col" className="num">Pos.</th></tr>
              </thead>
              <tbody>
                {pages.slice(0, 6).map((p) => (
                  <tr key={p.page}>
                    <td className="cell-url"><Truncate text={urlPath(p.page)} className="mono" /></td>
                    <td>
                      <span className="share">
                        <span className="share-track"><span className="share-fill" style={{ width: `${Math.max(2, p.share)}%` }} /></span>
                        <span className="num">{display(p.share)}%</span>
                      </span>
                    </td>
                    <td className="cell-text"><Truncate text={p.topKeyword} /></td>
                    <td className="num"><PositionBadge position={p.position} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <WidgetState kind="empty" title="No pages with search traffic yet" body="Pages appear once Search Console returns clicks or impressions for this period." />
          ))
        ) : !hasLinks ? (
          <WidgetState kind="empty" title="No backlinks imported" body="Import a backlink CSV in Backlink Profile to track new and lost referring domains." />
        ) : !velocity.dated ? (
          <WidgetState kind="empty" title="Imported links have no dates" body="Velocity needs first-seen and last-seen dates in the import." />
        ) : (
          <div className="velocity">
            <div className="velocity-col">
              <p className="velocity-head"><span className="velocity-count velocity-count--up">+{velocity.gained.length}</span> new referring domains</p>
              <ul>{velocity.gained.slice(0, 5).map((d) => <li key={d}><Truncate text={d} /></li>)}</ul>
            </div>
            <div className="velocity-col">
              <p className="velocity-head"><span className="velocity-count velocity-count--down">−{velocity.lost.length}</span> lost referring domains</p>
              <ul>{velocity.lost.slice(0, 5).map((d) => <li key={d}><Truncate text={d} /></li>)}</ul>
            </div>
            <p className="velocity-note">New: first seen in this period. Lost: every link last seen before the period's final day.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function PositionBadge({ position }: { position: number }) {
  if (!Number.isFinite(position)) return <span className="pos-badge">No Data</span>;
  const tier = position < 3.5 ? 1 : position < 10.5 ? 2 : position < 20.5 ? 3 : position < 50.5 ? 4 : 5;
  return <span className={`pos-badge pos-badge--${tier}`}>{display(position)}</span>;
}

/** Same geometry as the loaded overview so nothing moves when data arrives. */
export function OverviewSkeleton() {
  return (
    <div className="explorer" aria-busy="true" aria-label="Loading analytics">
      <section className="kpi-strip span-12">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="kpi" key={i}>
            <Skeleton className="sk-label" />
            <Skeleton className="sk-value" />
            <span className="kpi-foot"><Skeleton className="sk-badge" /><Skeleton className="sk-spark" /></span>
          </div>
        ))}
      </section>
      <section className="card span-12">
        <header className="card-head"><Skeleton className="sk-tabs" /></header>
        <div className="chart-body sk-chart">
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="sk-gridline" />)}
        </div>
      </section>
      {[0, 1].map((c) => (
        <section className="card span-6" key={c}>
          <header className="card-head"><Skeleton className="sk-tabs" /></header>
          {Array.from({ length: 5 }, (_, i) => <div className="sk-row" key={i}><Skeleton className="sk-cell" /></div>)}
        </section>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="explorer" aria-busy="true" aria-label="Loading">
      <section className="card span-12">
        <header className="card-head"><Skeleton className="sk-tabs" /></header>
        {Array.from({ length: rows }, (_, i) => <div className="sk-row" key={i}><Skeleton className="sk-cell" /></div>)}
      </section>
    </div>
  );
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where the clicks come from: device split and the top countries, from the same Search Console rows. */
function AudienceCards({ device, country }: { device: string; country: string }) {
  const [deviceMonth, setDeviceMonth] = useState("");
  const [countryMonth, setCountryMonth] = useState("");
  const deviceSrc = useSearchRows(deviceMonth);
  const countrySrc = useSearchRows(countryMonth);
  const devices = shareBy(deviceSrc.rows, "device");
  // shortcut: Search Console returns ISO alpha-3 codes and the platform has no alpha-3 name table, so codes are shown as-is; add a lookup if names are wanted.
  const countries = shareBy(countrySrc.rows, "country").slice(0, 8);
  const empty = <WidgetState kind="empty" title="No search measurements in this period" body="Sync Search Console or pick another month." />;
  return (
    <>
      <section className="card span-6" aria-labelledby="device-title">
        <header className="card-head">
          <h2 id="device-title">Device split</h2>
          {device && <span className="card-meta">Filtered to {title(device.toLowerCase())}</span>}
          <MonthFilter value={deviceMonth} onChange={setDeviceMonth} months={recentMonths()} />
        </header>
        {monthState(deviceSrc) ?? (deviceSrc.rows.length ? (
          <Donut label="Device" unit="clicks" parts={devices.map((d) => ({ name: title(d.name), value: d.clicks, share: d.share }))} />
        ) : empty)}
      </section>
      <section className="card span-6" aria-labelledby="country-title">
        <header className="card-head">
          <h2 id="country-title">Top countries</h2>
          <span className="card-meta">{country ? `Filtered to ${country.toUpperCase()}` : "By clicks"}</span>
          <MonthFilter value={countryMonth} onChange={setCountryMonth} months={recentMonths()} />
        </header>
        {monthState(countrySrc) ?? (countrySrc.rows.length ? (
          <HBars unit="clicks" rows={countries.map((c) => ({ name: c.name.toUpperCase(), value: c.clicks, note: `${display(c.share)}%` }))} />
        ) : empty)}
      </section>
    </>
  );
}
