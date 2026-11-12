import React, { useMemo } from "react";
import { useProject } from "../../context/ProjectContext";
import { auditSeverity, vitalRating } from "../../services/explorer";
import { display } from "../../services/measurements";
import { ScoreLine, StackedBars } from "./charts";
import { WidgetState } from "./ui";

const RATING = { good: "Good", improve: "Needs improvement", poor: "Poor", none: "No field data" } as const;

/** Findings per audit over time, and PageSpeed performance with the latest Core Web Vitals. */
export const AuditCharts: React.FC = () => {
  const { snapshot } = useProject();
  const audits = useMemo(() => auditSeverity(snapshot?.audits || [], snapshot?.findings || []), [snapshot]);
  const speed = useMemo(() => {
    const runs = snapshot?.pagespeed || [];
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
  }, [snapshot]);

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
        </header>
        {audits.length ? <StackedBars audits={audits} /> : (
          <WidgetState kind="empty" title="No completed site audits yet" body="Run a crawl to record the first audit; each later audit adds a column here." />
        )}
      </section>

      <section className="card span-12" aria-labelledby="speed-title">
        <header className="card-head">
          <h2 id="speed-title">PageSpeed performance</h2>
          {speed.url && <span className="card-meta mono" title={speed.url}>{speed.url}</span>}
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
                  // Low-traffic sites have no real-visitor (field) data; fall back to the Lighthouse lab value and say so. INP has no lab equivalent.
                  const field = speed.latest![m] ?? undefined;
                  const lab = m === "lcp" ? speed.latest!.labLcp : m === "cls" ? speed.latest!.labCls : undefined;
                  const v = field ?? lab ?? undefined;
                  const isLab = field === undefined && v !== undefined;
                  const rating = vitalRating(m, v);
                  return (
                    <div key={m} className={`vital vital--${rating}`}>
                      <dt>{{ lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift" }[m]}</dt>
                      <dd>
                        <span className="vital-value">{v === undefined ? "No Data" : m === "cls" ? display(v, 2) : `${display(v, 2)} s`}</span>
                        <span className="vital-rating">{RATING[rating]}{isLab ? " (lab)" : ""}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </>
        ) : (
          <WidgetState kind="empty" title="No PageSpeed tests yet" body="Run a PageSpeed test below; each later test adds a point to this trend." />
        )}
      </section>
    </div>
  );
};
