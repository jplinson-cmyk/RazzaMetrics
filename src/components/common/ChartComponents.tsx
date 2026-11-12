import React from "react";
import { curve } from "../explorer/charts";
import { ChartTip, MonthFilter, monthsIn } from "../explorer/MonthFilter";

interface RankTrendChartProps {
  data: number[];
  keyword?: string;
  labels?: string[];
  height?: number;
}

/** Average position over time for one keyword (1 at the top), with its own month filter and hover details. */
export const RankTrendChart: React.FC<RankTrendChartProps> = ({ data, keyword = "Rank Trend", labels = [], height = 160 }) => {
  const [month, setMonth] = React.useState("");
  const [hover, setHover] = React.useState<number | null>(null);
  if (!data || data.length < 2) return null;
  const all = data.map((val, i) => ({ val, label: labels[i] ?? String(i + 1) }));
  const months = monthsIn(labels.filter((l) => /^\d{4}-\d{2}/.test(l)));
  const pts = month ? all.filter((p) => p.label.startsWith(month)) : all;
  const W = 360, H = height, T = 18, B = 18, L = 8, R = 8;
  const min = Math.min(...pts.map((p) => p.val)), max = Math.max(...pts.map((p) => p.val));
  const range = Math.max(1, max - min);
  const x = (i: number) => L + (pts.length > 1 ? (i / (pts.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const y = (v: number) => T + ((v - min) / range) * (H - T - B);
  const line = curve(pts.map((p, i) => [x(i), y(p.val)]));
  const h = hover === null ? null : pts[hover];
  return (
    <div className="rank-trend">
      <div className="rank-trend-head">
        <span className="rank-trend-name">{keyword}</span>
        <span className="rank-trend-now">Avg. position {pts[pts.length - 1]?.val ?? "No Data"}</span>
        {months.length > 0 && <MonthFilter value={month} onChange={(m) => { setMonth(m); setHover(null); }} months={months} allLabel="All dates" />}
      </div>
      {pts.length ? (
        <div className="chart-frame">
          <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg rank-trend-svg" role="img"
            aria-label={`${keyword} average position: ${pts.map((p) => `${p.label} ${p.val}`).join(", ")}`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * W;
              setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((px - L) / (W - L - R)) * (pts.length - 1)))));
            }}>
            <line className="grid" x1={L} x2={W - R} y1={T} y2={T} />
            <line className="grid" x1={L} x2={W - R} y1={H - B} y2={H - B} />
            {h && <line className="crosshair" x1={x(hover!)} x2={x(hover!)} y1={T} y2={H - B} />}
            <path className="series-alt-solid" d={line} />
            {pts.map((p, i) => (
              <circle key={i} className="dot-alt" cx={x(i)} cy={y(p.val)} r={i === hover ? 5.5 : 3.5} />
            ))}
          </svg>
          {h && <ChartTip x={(x(hover!) / W) * 100} title={h.label} rows={[{ label: "Avg. position", value: String(h.val) }]} />}
        </div>
      ) : (
        <p className="chart-loading">No positions recorded in this month.</p>
      )}
      <div className="rank-trend-axis">
        <span>{pts[0]?.label}</span>
        <span>{pts[pts.length - 1]?.label}</span>
      </div>
    </div>
  );
};

interface RankingDistributionBarProps {
  top3: number;
  top10: number;
  top20: number;
  top50: number;
  top100: number;
}

export const RankingDistributionBar: React.FC<RankingDistributionBarProps> = ({
  top3,
  top10,
  top20,
  top50,
  top100,
}) => {
  const total = top3 + top10 + top20 + top50 + top100;
  if (!total)
    return (
      <p className="text-sm text-gray-500">
        No measured keyword positions available.
      </p>
    );
  const pTop3 = Math.round((top3 / total) * 100);
  const pTop10 = Math.round((top10 / total) * 100);
  const pTop20 = Math.round((top20 / total) * 100);
  const pTop50 = Math.round((top50 / total) * 100);
  const pTop100 = Math.max(0, 100 - (pTop3 + pTop10 + pTop20 + pTop50));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span className="font-medium">Average position distribution</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {total} Keywords
        </span>
      </div>

      {/* Stacked bar */}
      <div className="w-full h-3.5 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden flex shadow-inner">
        <div
          style={{ width: `${pTop3}%` }}
          className="bg-razza-500 hover:opacity-90 transition-colors duration-300"
          title={`Top 3: ${top3} (${pTop3}%)`}
        />
        <div
          style={{ width: `${pTop10}%` }}
          className="bg-emerald-500 hover:opacity-90 transition-colors duration-300"
          title={`Positions 4-10: ${top10} (${pTop10}%)`}
        />
        <div
          style={{ width: `${pTop20}%` }}
          className="bg-sky-500 hover:opacity-90 transition-colors duration-300"
          title={`Positions 11-20: ${top20} (${pTop20}%)`}
        />
        <div
          style={{ width: `${pTop50}%` }}
          className="bg-amber-500 hover:opacity-90 transition-colors duration-300"
          title={`Positions 21-50: ${top50} (${pTop50}%)`}
        />
        <div
          style={{ width: `${pTop100}%` }}
          className="bg-gray-400 dark:bg-gray-600 hover:opacity-90 transition-colors duration-300"
          title={`Positions 51-100: ${top100} (${pTop100}%)`}
        />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-razza-500 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">Top 3:</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {top3}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">4-10:</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {top10}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">11-20:</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {top20}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">21-50:</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {top50}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">51-100:</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {top100}
          </span>
        </div>
      </div>
    </div>
  );
};

interface ToxicityDonutProps {
  toxic: number;
  suspicious: number;
  clean: number;
  overallScore: number;
}

export const ToxicityDonut: React.FC<ToxicityDonutProps> = ({
  toxic,
  suspicious,
  clean,
  overallScore,
}) => {
  const total = toxic + suspicious + clean || 1;
  if (!Number.isFinite(overallScore))
    return (
      <p className="text-sm text-gray-500">
        No evaluated backlinks. Import observations and recalculate risk.
      </p>
    );
  const pToxic = (toxic / total) * 100;
  const pSuspicious = (suspicious / total) * 100;
  const pClean = (clean / total) * 100;

  const size = 130;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;

  const offsetToxic = circ - (pToxic / 100) * circ;
  const offsetSuspicious = circ - (pSuspicious / 100) * circ;
  const offsetClean = circ - (pClean / 100) * circ;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-100 dark:text-dark-border"
            fill="transparent"
          />
          {/* Clean (Green) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-cool)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offsetClean}
            strokeLinecap="round"
            fill="transparent"
          />
          {/* Suspicious (Amber) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-accent)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offsetSuspicious}
            strokeLinecap="round"
            fill="transparent"
            transform={`rotate(${(pClean / 100) * 360} ${size / 2} ${size / 2})`}
          />
          {/* Toxic (Rose/Red) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-bad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offsetToxic}
            strokeLinecap="round"
            fill="transparent"
            transform={`rotate(${((pClean + pSuspicious) / 100) * 360} ${size / 2} ${size / 2})`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold font-heading text-gray-900 dark:text-white">
            {overallScore}
          </span>
          <span className="text-[10px] font-bold text-gray-500">
            Toxicity
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-medium text-rose-800 dark:text-rose-300">
              High / critical risk
            </span>
          </div>
          <span className="font-bold text-rose-900 dark:text-rose-200">
            {toxic} links
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="font-medium text-amber-800 dark:text-amber-300">
              Medium Risk
            </span>
          </div>
          <span className="font-bold text-amber-900 dark:text-amber-200">
            {suspicious} links
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-razza-500" />
            <span className="font-medium text-emerald-800 dark:text-emerald-300">
              Low observed risk
            </span>
          </div>
          <span className="font-bold text-emerald-900 dark:text-emerald-200">
            {clean} links
          </span>
        </div>
      </div>
    </div>
  );
};
