import React, { useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { aggregate, display, type PerformanceRow } from "../../services/measurements";
import { movers } from "../../services/explorer";
import { CtrScatter, Diverging, type ScatterPoint } from "./charts";
import { SegmentedTabs, Truncate, WidgetState } from "./ui";
import { MonthFilter, recentMonths, useSearchRows } from "./MonthFilter";

/** Keyword totals from raw rows, shaped like the project's organic keywords. */
function keywordsFrom(rows: PerformanceRow[], previous: PerformanceRow[]) {
  const group = (list: PerformanceRow[]) => {
    const m = new Map<string, PerformanceRow[]>();
    for (const r of list) (m.get(r.keyword) ?? m.set(r.keyword, []).get(r.keyword)!).push(r);
    return m;
  };
  const before = group(previous);
  return [...group(rows)].map(([keyword, g]) => {
    const a = aggregate(g);
    return { keyword, position: a.position, previousPosition: aggregate(before.get(keyword) ?? []).position, trafficEstimate: a.clicks, volume: a.impressions };
  });
}

/** The project's keywords for the top bar's range, or one month's keywords fetched for this chart. */
function useMonthKeywords(month: string) {
  const { organicKeywords } = useProject();
  const src = useSearchRows(month);
  const keywords = useMemo(() => (month ? keywordsFrom(src.rows, src.previous) : organicKeywords), [month, src.rows, src.previous, organicKeywords]);
  return { keywords, loading: src.loading, error: src.error };
}

const monthState = (s: { loading: boolean; error: string }) =>
  s.error ? <WidgetState kind="error" title="This month could not load" body={s.error} /> : s.loading ? <p className="chart-loading" role="status">Loading month…</p> : null;

// Same rule as the "Low CTR" chip on this screen: 100+ impressions and fewer than 2% clicks.
const isOpportunity = (impressions: number, ctr: number) => impressions >= 100 && ctr < 2;

/** CTR against position (where clicks are being left behind) and the keywords that moved most. */
export const KeywordCharts: React.FC = () => {
  const [ctrMonth, setCtrMonth] = useState("");
  const [moveMonth, setMoveMonth] = useState("");
  const ctrSrc = useMonthKeywords(ctrMonth);
  const moveSrc = useMonthKeywords(moveMonth);
  const [moves, setMoves] = useState<"gainers" | "losers">("gainers");
  const points: ScatterPoint[] = useMemo(
    () =>
      ctrSrc.keywords
        .filter((k) => Number.isFinite(k.position) && k.volume > 0)
        .map((k) => {
          const ctr = (k.trafficEstimate / k.volume) * 100;
          return { keyword: k.keyword, position: k.position, ctr, impressions: k.volume, clicks: k.trafficEstimate, opportunity: isOpportunity(k.volume, ctr) };
        }),
    [ctrSrc.keywords],
  );
  const opportunities = points.filter((p) => p.opportunity).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  const moved = useMemo(() => movers(moveSrc.keywords, 8), [moveSrc.keywords]);
  const list = moves === "gainers" ? moved.gainers : moved.losers;

  return (
    <div className="explorer">
      <section className="card span-12" aria-labelledby="ctr-title">
        <header className="card-head">
          <h2 id="ctr-title">Click-through rate by position</h2>
          <span className="card-meta legend-static">
            <span><span className="swatch swatch--opportunity" aria-hidden="true" /> Low CTR: 100+ impressions, under 2%</span>
            <span><span className="swatch swatch--normal" aria-hidden="true" /> Other keywords; dot size is impressions</span>
          </span>
          <MonthFilter value={ctrMonth} onChange={setCtrMonth} months={recentMonths()} />
        </header>
        {monthState(ctrSrc) ?? (points.length ? (
          <>
            <CtrScatter points={points} />
            {opportunities.length > 0 && (
              <div className="table-scroll">
                <table className="data-table data-table--full">
                  <caption className="table-caption">Biggest click-through opportunities</caption>
                  <thead>
                    <tr><th scope="col">Keyword</th><th scope="col" className="num">Avg. position</th><th scope="col" className="num">CTR</th><th scope="col" className="num">Impressions</th><th scope="col" className="num">Clicks</th></tr>
                  </thead>
                  <tbody>
                    {opportunities.map((p) => (
                      <tr key={p.keyword}>
                        <td className="cell-text"><Truncate text={p.keyword} /></td>
                        <td className="num">{display(p.position)}</td>
                        <td className="num">{display(p.ctr)}%</td>
                        <td className="num">{p.impressions.toLocaleString()}</td>
                        <td className="num">{p.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <WidgetState kind="empty" title="No keywords with impressions in this period" body="Sync Search Console or pick another month." />
        ))}
      </section>

      <section className="card span-12" aria-labelledby="movers-title">
        <header className="card-head">
          <h2 id="movers-title" className="visually-hidden">Keyword movement</h2>
          <SegmentedTabs
            label="Keyword movement"
            variant="underline"
            idBase="movers"
            value={moves}
            onChange={setMoves}
            options={[
              { value: "gainers", label: `Winners (${moved.gainers.length})` },
              { value: "losers", label: `Losers (${moved.losers.length})` },
            ]}
          />
          <span className="card-meta">{moveMonth ? "Against the same number of days just before" : "Positions gained or lost against the previous period"}</span>
          <MonthFilter value={moveMonth} onChange={setMoveMonth} months={recentMonths()} />
        </header>
        <div id="movers-panel" role="tabpanel" aria-labelledby={`movers-tab-${moves}`}>
          {monthState(moveSrc) ?? (list.length ? (
            <Diverging rows={list} />
          ) : (
            <WidgetState
              kind="empty"
              title={moves === "gainers" ? "No keyword moved up" : "No keyword moved down"}
              body="Movement needs the same keyword in both this period and the previous one."
            />
          ))}
        </div>
      </section>
    </div>
  );
};
