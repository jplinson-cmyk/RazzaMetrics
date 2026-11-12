import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import { exportToCsv } from "../../utils/csvExport";
import { aggregate, display, unpackRows, type PerformanceRow } from "../../services/measurements";
import { backlinkVelocity, delta, topPages, urlPath } from "../../services/explorer";
import { DeltaBadge } from "../explorer/ui";
import { Logo } from "../brand/Logo";

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** First and last day of a calendar month, YYYY-MM-DD, in UTC. */
const monthRange = (y: number, m: number) => ({ start: iso(Date.UTC(y, m, 1)), end: iso(Date.UTC(y, m + 1, 0)) });

interface Ga4Totals { sessions: number; totalUsers: number; keyEvents: number; engagementRate: number }
interface Ga4Report { current: Ga4Totals; previous: Ga4Totals; landingPages: { page: string; sessions: number; keyEvents: number }[] }

/**
 * A calendar month against the month before, from stored measurements (and GA4 when linked).
 * Prints to a clean page for PDF; the CSV keeps the headline figures.
 */
export const MonthlyReportModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentProject, snapshot, backlinks } = useProject();
  const now = new Date();
  const [month, setMonth] = useState(() => iso(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).slice(0, 7));
  const [rows, setRows] = useState<{ cur: PerformanceRow[]; prev: PerformanceRow[] } | null>(null);
  const [ga4, setGa4] = useState<Ga4Report | null>(null);
  const [ga4Error, setGa4Error] = useState("");
  const [error, setError] = useState("");

  const [y, m] = month.split("-").map(Number);
  const range = monthRange(y, m - 1);
  const prevRange = monthRange(y, m - 2);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const prevLabel = new Date(Date.UTC(y, m - 2, 1)).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });

  useEffect(() => {
    if (!isOpen || !currentProject.id) return;
    let alive = true;
    setRows(null);
    setError("");
    setGa4(null);
    setGa4Error("");
    const data = (r: { start: string; end: string }) =>
      projectApi<{ performance: PerformanceRow[] }>(currentProject.id, `data?start=${r.start}&end=${r.end}&only=performance`).then((d) => unpackRows(d.performance));
    Promise.all([data(range), data(prevRange)])
      .then(([cur, prev]) => alive && setRows({ cur, prev }))
      .catch((e) => alive && setError(e.message));
    if (currentProject.ga4Property)
      projectApi<Ga4Report>(currentProject.id, `ga4/report?start=${range.start}&end=${range.end}&prevStart=${prevRange.start}&prevEnd=${prevRange.end}`)
        .then((r) => alive && setGa4(r))
        .catch((e) => alive && setGa4Error(e.message));
    return () => {
      alive = false;
    };
  }, [isOpen, currentProject.id, currentProject.ga4Property, month]);

  const model = useMemo(() => {
    if (!rows) return null;
    const cur = aggregate(rows.cur);
    const prev = aggregate(rows.prev);
    const queries = new Map<string, PerformanceRow[]>();
    for (const r of rows.cur) (queries.get(r.keyword) ?? queries.set(r.keyword, []).get(r.keyword)!).push(r);
    const topQueries = [...queries]
      .map(([keyword, list]) => ({ keyword, ...aggregate(list), previous: aggregate(rows.prev.filter((r) => r.keyword === keyword)).position }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 10);
    const audits = (snapshot?.audits || []).filter((a) => a.status === "completed" && a.completedAt && a.completedAt.slice(0, 10) <= range.end);
    const audit = audits.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
    const findings = audit ? (snapshot?.findings || []).filter((f) => f.auditId === audit.id) : [];
    const psi = (strategy: string) =>
      (snapshot?.pagespeed || []).filter((p) => p.strategy === strategy && p.testedAt.slice(0, 10) <= range.end).sort((a, b) => b.testedAt.localeCompare(a.testedAt))[0];
    return {
      cur,
      prev,
      topQueries,
      pages: topPages(rows.cur, rows.prev).slice(0, 10),
      audit,
      severity: { error: findings.filter((f) => f.severity === "error").length, warning: findings.filter((f) => f.severity === "warning").length, notice: findings.filter((f) => f.severity === "notice").length },
      mobile: psi("mobile"),
      desktop: psi("desktop"),
      links: backlinkVelocity(backlinks.map((b) => ({ sourceDomain: b.sourceDomain, firstSeen: b.firstSeen, lastSeen: b.lastSeen })), range.start, range.end),
      openIssues: (snapshot?.issues || []).filter((i) => i.status !== "resolved"),
    };
  }, [rows, snapshot, backlinks, range.end, range.start]);

  if (!isOpen) return null;
  const metric = (label: string, value: string, change: number, lowerIsBetter = false) => (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <DeltaBadge value={change} lowerIsBetter={lowerIsBetter} />
    </div>
  );
  const exportCsv = () =>
    model &&
    exportToCsv(`razza-metrics-${currentProject.domain}-${month}`, [
      {
        Site: currentProject.domain,
        ProjectCode: currentProject.code || "",
        Month: month,
        Clicks: model.cur.clicks,
        ClicksPreviousMonth: model.prev.clicks,
        Impressions: model.cur.impressions,
        ImpressionsPreviousMonth: model.prev.impressions,
        AveragePosition: display(model.cur.position),
        Sessions: ga4?.current.sessions ?? "",
        Users: ga4?.current.totalUsers ?? "",
        KeyEvents: ga4?.current.keyEvents ?? "",
        NewReferringDomains: model.links.gained.length,
        LostReferringDomains: model.links.lost.length,
        AuditErrors: model.severity.error,
        OpenIssues: model.openIssues.length,
      },
    ]);

  return (
    <div className="report-overlay" onClick={onClose}>
      <article className="report-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
        <header className="report-head">
          <Logo size={28} />
          <div className="report-actions">
            <label className="context-select">
              <span className="visually-hidden">Report month</span>
              <input type="month" value={month} max={iso(now.getTime()).slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => window.print()} disabled={!model}>
              <Printer className="w-4 h-4" aria-hidden="true" /> Print or save PDF
            </button>
            <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!model}>
              <Download className="w-4 h-4" aria-hidden="true" /> CSV
            </button>
            <button type="button" className="icon-button" aria-label="Close report" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
        <h1 id="report-title">Monthly SEO report: {monthLabel}</h1>
        <p className="report-sub">
          {currentProject.code ? `${currentProject.code}, ` : ""}
          {currentProject.name} ({currentProject.domain}), compared with {prevLabel}. Generated {new Date().toLocaleDateString()}.
        </p>

        {error && <p role="alert" className="login-error">{error}</p>}
        {!model && !error && <p role="status" className="report-sub">Loading the month…</p>}

        {model && (
          <>
            <section className="report-section">
              <h2>Search (Google Search Console)</h2>
              {rows!.cur.length ? (
                <div className="report-metrics">
                  {metric("Clicks", model.cur.clicks.toLocaleString(), delta(model.cur.clicks, model.prev.clicks))}
                  {metric("Impressions", model.cur.impressions.toLocaleString(), delta(model.cur.impressions, model.prev.impressions))}
                  {metric("Click-through rate", `${display(model.cur.ctr)}%`, delta(model.cur.ctr, model.prev.ctr))}
                  {metric("Average position", display(model.cur.position), delta(model.cur.position, model.prev.position), true)}
                </div>
              ) : (
                <p className="report-note">No Search Console data for this month. Link Search Console from the project strip.</p>
              )}
            </section>

            <section className="report-section">
              <h2>Visitors (Google Analytics)</h2>
              {ga4 ? (
                <>
                  <div className="report-metrics">
                    {metric("Sessions", ga4.current.sessions.toLocaleString(), delta(ga4.current.sessions, ga4.previous.sessions))}
                    {metric("Users", ga4.current.totalUsers.toLocaleString(), delta(ga4.current.totalUsers, ga4.previous.totalUsers))}
                    {metric("Key events", ga4.current.keyEvents.toLocaleString(), delta(ga4.current.keyEvents, ga4.previous.keyEvents))}
                    {metric("Engagement rate", `${display(ga4.current.engagementRate * 100)}%`, delta(ga4.current.engagementRate, ga4.previous.engagementRate))}
                  </div>
                  {ga4.landingPages.length > 0 && (
                    <table className="data-table report-table">
                      <thead><tr><th scope="col">Landing page</th><th scope="col" className="num">Sessions</th><th scope="col" className="num">Key events</th></tr></thead>
                      <tbody>
                        {ga4.landingPages.map((p) => (
                          <tr key={p.page}><td className="cell-url"><span className="truncate-cell mono" title={p.page}>{p.page}</span></td><td className="num">{p.sessions.toLocaleString()}</td><td className="num">{p.keyEvents.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <p className="report-note">
                  {ga4Error || (currentProject.ga4Property ? "Loading Analytics…" : "Google Analytics is not linked for this site, so sessions and conversions are not included.")}
                </p>
              )}
            </section>

            {model.topQueries.length > 0 && (
              <section className="report-section report-split">
                <div>
                  <h2>Top queries</h2>
                  <table className="data-table report-table">
                    <thead><tr><th scope="col">Query</th><th scope="col" className="num">Clicks</th><th scope="col" className="num">Position</th></tr></thead>
                    <tbody>
                      {model.topQueries.map((q) => (
                        <tr key={q.keyword}><td className="cell-text"><span className="truncate-cell" title={q.keyword}>{q.keyword}</span></td><td className="num">{q.clicks.toLocaleString()}</td><td className="num">{display(q.position)}<span className="report-prev"> (was {display(q.previous)})</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h2>Top pages</h2>
                  <table className="data-table report-table">
                    <thead><tr><th scope="col">Page</th><th scope="col" className="num">Clicks</th><th scope="col" className="num">Change</th></tr></thead>
                    <tbody>
                      {model.pages.map((p) => (
                        <tr key={p.page}><td className="cell-url"><span className="truncate-cell mono" title={p.page}>{urlPath(p.page)}</span></td><td className="num">{p.clicks.toLocaleString()}</td><td className="num"><DeltaBadge value={delta(p.clicks, p.previousClicks)} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="report-section">
              <h2>Technical health and links</h2>
              <dl className="report-facts">
                <div><dt>Latest audit</dt><dd>{model.audit ? `${new Date(model.audit.completedAt!).toLocaleDateString()}, ${model.audit.pagesCrawled} pages` : "None by month end"}</dd></div>
                <div><dt>Audit findings</dt><dd>{model.audit ? `${model.severity.error} errors, ${model.severity.warning} warnings, ${model.severity.notice} notices` : "No Data"}</dd></div>
                <div><dt>PageSpeed (mobile / desktop)</dt><dd>{model.mobile || model.desktop ? `${model.mobile?.performance ?? "–"} / ${model.desktop?.performance ?? "–"}` : "Not tested by month end"}</dd></div>
                <div><dt>Referring domains</dt><dd>{model.links.total ? `${model.links.total} total, +${model.links.gained.length} new, −${model.links.lost.length} lost this month` : "No backlinks imported"}</dd></div>
                <div><dt>Open issues</dt><dd>{model.openIssues.length ? `${model.openIssues.length} (${model.openIssues.filter((i) => i.severity === "error").length} critical)` : "None"}</dd></div>
              </dl>
            </section>
            <p className="report-note">Figures are stored measurements: Search Console top queries, Google Analytics where linked, imported backlinks, and server-side audits. Nothing is estimated.</p>
          </>
        )}
      </article>
    </div>
  );
};
