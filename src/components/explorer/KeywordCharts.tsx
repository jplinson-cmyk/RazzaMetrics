import React, { useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { display } from "../../services/measurements";
import { movers } from "../../services/explorer";
import { CtrScatter, Diverging, type ScatterPoint } from "./charts";
import { SegmentedTabs, Truncate, WidgetState } from "./ui";

// Same rule as the "Low CTR" chip on this screen: 100+ impressions and fewer than 2% clicks.
const isOpportunity = (impressions: number, ctr: number) => impressions >= 100 && ctr < 2;

/** CTR against position (where clicks are being left behind) and the keywords that moved most. */
export const KeywordCharts: React.FC = () => {
  const { organicKeywords } = useProject();
  const [moves, setMoves] = useState<"gainers" | "losers">("gainers");
  const points: ScatterPoint[] = useMemo(
    () =>
      organicKeywords
        .filter((k) => Number.isFinite(k.position) && k.volume > 0)
        .map((k) => {
          const ctr = (k.trafficEstimate / k.volume) * 100;
          return { keyword: k.keyword, position: k.position, ctr, impressions: k.volume, clicks: k.trafficEstimate, opportunity: isOpportunity(k.volume, ctr) };
        }),
    [organicKeywords],
  );
  const opportunities = points.filter((p) => p.opportunity).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  const moved = useMemo(() => movers(organicKeywords, 8), [organicKeywords]);
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
        </header>
        {points.length ? (
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
          <WidgetState kind="empty" title="No keywords with impressions in this period" body="Sync Search Console or widen the timeframe." />
        )}
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
          <span className="card-meta">Positions gained or lost against the previous period</span>
        </header>
        <div id="movers-panel" role="tabpanel" aria-labelledby={`movers-tab-${moves}`}>
          {list.length ? (
            <Diverging rows={list} />
          ) : (
            <WidgetState
              kind="empty"
              title={moves === "gainers" ? "No keyword moved up" : "No keyword moved down"}
              body="Movement needs the same keyword in both this period and the previous one."
            />
          )}
        </div>
      </section>
    </div>
  );
};
