import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { navItems, type ActiveTab } from "../layout/Sidebar";
import { SegmentedTabs } from "./ui";
import { DateRange } from "./DateRange";

const TIMEFRAMES = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "182", label: "6m" },
  { value: "365", label: "1y" },
] as const;
const DEVICES = [
  { value: "", label: "All devices" },
  { value: "DESKTOP", label: "Desktop" },
  { value: "MOBILE", label: "Mobile" },
];
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const ContextBar: React.FC<{ activeTab: ActiveTab; onNavigate: (tab: ActiveTab) => void }> = ({
  activeTab,
  onNavigate,
}) => {
  const { currentProject, filters, setFilters, snapshot, refreshing } = useProject();
  // Countries seen in any load stay selectable after a filter narrows the data to one of them.
  const [countries, setCountries] = useState<string[]>([]);
  useEffect(() => {
    const seen = snapshot?.performance.map((r) => r.country).filter(Boolean) || [];
    if (seen.length) setCountries((old) => [...new Set([...old, ...seen])].sort());
  }, [snapshot]);
  useEffect(() => setCountries([]), [currentProject.id]);

  const span = Math.round((Date.parse(filters.end) - Date.parse(filters.start)) / 86400000) + 1;
  const timeframe = TIMEFRAMES.find((t) => Math.abs(Number(t.value) - span) <= 1)?.value ?? "custom";
  const tabLabel = navItems.find((i) => i.id === activeTab)?.label ?? "";

  return (
    <div className="context-bar" aria-busy={refreshing}>
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          <li>
            <button type="button" className="crumb-link" onClick={() => onNavigate("overview")} title={currentProject.domain}>
              {currentProject.domain || currentProject.name}
            </button>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-4 h-4" />
          </li>
          <li aria-current="page" className="crumb-current">
            {tabLabel}
          </li>
        </ol>
      </nav>

      <div className="context-controls">
        <label className="context-select">
          <span className="visually-hidden">Country database</span>
          <select
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          >
            <option value="">All countries</option>
            {[...new Set([...countries, filters.country].filter(Boolean))].map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <SegmentedTabs
          label="Device"
          value={filters.device}
          options={DEVICES}
          onChange={(device) => setFilters((f) => ({ ...f, device }))}
        />
        <SegmentedTabs
          label="Timeframe"
          value={timeframe}
          options={[...TIMEFRAMES]}
          onChange={(v) => {
            // Presets always end today; other ranges come from the date button.
            const end = Date.now();
            setFilters((f) => ({ ...f, start: iso(end - (Number(v) - 1) * 86400000), end: iso(end) }));
          }}
        />
        <DateRange start={filters.start} end={filters.end} onApply={(start, end) => setFilters((f) => ({ ...f, start, end }))} />
        <span className={`updating-pill ${refreshing ? "is-on" : ""}`} role="status" aria-live="polite">
          {refreshing ? "Updating analytics…" : ""}
        </span>
      </div>
      {snapshot?.truncated && (
        <p className="truncation-note" role="status">
          This period has more than 10,000 Search Console rows, so only the newest 10,000 are shown. Narrow the timeframe, device or country to see every row.
        </p>
      )}
      <span className={`progress-line ${refreshing ? "is-on" : ""}`} aria-hidden="true" />
    </div>
  );
};
