import React from "react";

interface RankTrendChartProps {
  data: number[];
  keyword?: string;
  labels?: string[];
  height?: number;
}

export const RankTrendChart: React.FC<RankTrendChartProps> = ({
  data,
  keyword = "Rank Trend",
  labels = [],
  height = 160,
}) => {
  if (!data || data.length < 2) return null;

  const minRank = Math.min(...data);
  const maxRank = Math.max(...data);
  // For ranking, lower number (1) is better, so rank 1 should be at the top of the chart!
  const paddingY = 20;
  const chartHeight = height - paddingY * 2;
  const width = 360;
  const stepX = width / (data.length - 1);

  // Normalize: rank 1 => top (paddingY), higher rank => bottom
  const rankRange = Math.max(1, maxRank - minRank);
  const points = data.map((val, idx) => {
    const x = idx * stepX;
    // Lower rank = smaller y (higher on screen)
    const normalized = (val - minRank) / rankRange;
    const y = paddingY + normalized * chartHeight;
    return { x, y, val };
  });

  const svgPath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaPath = `${svgPath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
          {keyword}
        </span>
        <span className="text-razza-600 dark:text-razza-400 font-bold">
          Avg. position {data[data.length - 1]}
        </span>
      </div>

      <div className="relative w-full overflow-hidden" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="rankGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-cool)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-cool)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background area */}
          <path d={areaPath} fill="url(#rankGradient)" />

          {/* Guide lines */}
          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-gray-200 dark:text-dark-border"
          />
          <line
            x1="0"
            y1={height - paddingY}
            x2={width}
            y2={height - paddingY}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-gray-200 dark:text-dark-border"
          />

          {/* Trend line */}
          <path
            d={svgPath}
            fill="none"
            stroke="var(--color-cool)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="var(--color-paper-2)"
                stroke="var(--color-cool)"
                strokeWidth="2.5"
                className="transition-transform duration-150 hover:scale-125"
              />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize="10"
                className="fill-gray-600 dark:fill-gray-300 font-semibold"
              >
                #{p.val}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        {labels.map((l, idx) => (
          <span key={idx}>{l}</span>
        ))}
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
