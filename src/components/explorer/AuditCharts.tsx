import React, { useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { auditSeverity, vitalRating } from "../../services/explorer";
import { display } from "../../services/measurements";
import { ScoreLine, StackedBars } from "./charts";
import { WidgetState } from "./ui";
import { MonthFilter, monthsIn } from "./MonthFilter";

const RATING = { good: "Good", improve: "Needs improvement", poor: "Poor", none: "No field data" } as const;

/** Findings per audit over time, and PageSpeed performance with the latest Core Web Vitals. */
export const AuditCharts: React.FC = () => {
  const { snapshot } = useProject();
  const [auditMonth, setAuditMonth] = useState("");
  const [speedMonth, setSpeedMonth] = useState("");
  const allAudits = useMemo(() => auditSeverity(snapshot?.audits || [], snapshot?.findings || []), [snapshot]);
  const audits = auditMonth ? allAudits.filter((a) => a.date.startsWith(auditMonth)) : allAudits;
  const speedMonths = useMemo(() => monthsIn((snapshot?.pagespeed || []).map((r) => r.testedAt)), [snapshot]);
  const speed = useMemo(() => {
    const runs = (snapshot?.pagespeed || []).filter((r) => !speedMonth || r.testedAt.startsWith(speedMonth));
    // Trend one URL: the one tested most often (usually the home page).
    const counts = new Map<string, number>();
    for (const r of runs) counts.set(r.url, (counts.get(r.url) || 0) + 1);
    const url = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    const mine = runs.filter((r) => r.url === url).sort((a, b) => a.testedAt.localeCompare(b.testedAt));
    const series = (["mobile", "desktop"] as const).map((strategy) => ({
      name: strategy === "mobile" ? "Mobile" : "Desktop",
      className: `score-${strategy}`,
      points: mine.filter((r) => r.strategy === strategy && r.performance !== null)
        .map((r) => ({ date: r.testedAt.slice(0, 10), value: Math.round(r.performance!) })),
    })).filter((s) => s.points.length);
    const latest = [...mine].reverse().find((r) => r.strategy === "mobile") ?? mine[mine.length - 1];
    return { url, series, latest };
  }, [snapshot, speedMonth]);

  return (
    <div className="explorer">
      <section className="card span-12" aria-labelledby="audit-trend-title">
        <header className="card-head">
          <h2 id="audit-trend-title">Findings per site audit</h2>
          <span className="card-meta legend-static">
            <span><span className="swatch seg-error-bg" aria-hidden="true" /> Errors</span>
            <span><span className="swatch seg-warning-bg" aria-hidden="true" /> Warnings</span>
            <span><span className="swatch seg-notice-bg" aria-hidden="true" /> Notices</span>
          </span>
          <MonthFilter value={auditMonth} onChange={setAuditMonth} months={monthsIn(allAudits.map((a) => a.date))} allLabel="All audits" />
        </header>
        {audits.length ? <StackedBars audits={audits} /> : auditMonth ? (
          <WidgetState kind="empty" title="No audits in this month" body="Pick another month or All audits." />
        ) : (
          <WidgetState kind="empty" title="No completed site audits yet" body="Run a crawl to record the first audit; each later audit adds a column here." />
        )}
      </section>

      <section className="card span-12" aria-labelledby="speed-title">
        <header className="card-head">
          <h2 id="speed-title">PageSpeed performance</h2>
          {speed.url && <span className="card-meta mono" title={speed.url}>{speed.url}</span>}
          <MonthFilter value={speedMonth} onChange={setSpeedMonth} months={speedMonths} allLabel="All tests" />
        </header>
        {speed.series.length ? (
          <>
            <div className="legend-static card-meta">
              {speed.series.map((s) => <span key={s.name}><span className={`swatch swatch--${s.className}`} aria-hidden="true" /> {s.name}</span>)}
              <span>Lighthouse score; 90+ is good, under 50 is poor</span>
            </div>
            <ScoreLine series={speed.series} />
            {speed.latest && (
              <dl className="vitals">
                {(["lcp", "inp", "cls"] as const).map((m) => {
                  // Low-traffic sites have no real-visitor (field) data; fall back to the Lighthouse lab value and say so.
                  // INP has no lab form, so Total Blocking Time (Google's lab stand-in for it) is shown instead.
                  const latest = speed.latest!;
                  const field = latest[m] ?? undefined;
                  const lab = m === "lcp" ? latest.labLcp : m === "cls" ? latest.labCls : latest.labTbt;
                  const v = field ?? lab ?? undefined;
                  const isLab = field === undefined && v !== undefined;
                  const metricKey = m === "inp" && isLab ? "tbt" : m;
                  const rating = vitalRating(metricKey, v);
                  const name = { lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time" }[metricKey];
                  const source = isLab ? " (lab)" : latest.fieldScope === "site" ? " (site-wide)" : "";
                  return (
                    <div key={m} className={`vital vital--${rating}`}>
                      <dt>{name}</dt>
                      <dd>
                        <span className="vital-value">{v === undefined ? "No Data" : m === "cls" ? display(v, 2) : `${display(v, 2)} s`}</span>
                        <span className="vital-rating">{RATING[rating]}{source}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </>
        ) : (
          <WidgetState kind="empty" title={speedMonth ? "No PageSpeed tests in this month" : "No PageSpeed tests yet"} body={speedMonth ? "Pick another month or All tests." : "Run a PageSpeed test below; each later test adds a point to this trend."} />
        )}
      </section>
    </div>
  );
};
