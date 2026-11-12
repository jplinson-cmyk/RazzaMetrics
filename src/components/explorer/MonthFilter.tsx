import React, { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import type { PerformanceRow } from "../../services/measurements";

/** "2026-10" → first and last day of that month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), today = new Date().toISOString().slice(0, 10);
  // The current month ends today, so the chart has no empty future days.
  return { start: `${month}-01`, end: last < today ? last : today };
}

const label = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });

/** The last `n` calendar months, newest first. Search Console keeps about 16 months. */
export function recentMonths(n = 12) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}

/** Distinct months in a list of dates, newest first. */
export const monthsIn = (dates: (string | undefined)[]) =>
  [...new Set(dates.filter(Boolean).map((d) => d!.slice(0, 7)))].sort().reverse();

/** A chart's own month picker. Empty value means the date range chosen in the top bar. */
export function MonthFilter({ value, onChange, months, allLabel = "Selected range" }: {
  value: string;
  onChange: (month: string) => void;
  months: string[];
  allLabel?: string;
}) {
  return (
    <label className="chart-month">
      <CalendarDays className="w-4 h-4" aria-hidden="true" />
      <span className="visually-hidden">Month</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {[...new Set([...months, value].filter(Boolean))].sort().reverse().map((m) => <option key={m} value={m}>{label(m)}</option>)}
      </select>
    </label>
  );
}

/**
 * Search Console rows for one chart: the top bar's range by default, or one month fetched on its own,
 * so each chart can look at a different month without changing the rest of the page.
 */
export function useSearchRows(month: string) {
  const { snapshot, currentProject, filters } = useProject();
  const [fetched, setFetched] = useState<{ key: string; rows: PerformanceRow[]; previous: PerformanceRow[] } | null>(null);
  const [error, setError] = useState("");
  const key = month && `${currentProject.id}|${month}|${filters.device}|${filters.country}`;
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setError("");
    const { start, end } = monthRange(month);
    const q = new URLSearchParams({ start, end, device: filters.device, country: filters.country, only: "performance" });
    projectApi<{ performance: PerformanceRow[]; previousPerformance: PerformanceRow[] }>(currentProject.id, `data?${q}`)
      .then((d) => alive && setFetched({ key, rows: d.performance, previous: d.previousPerformance }))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [key]);
  if (!month) {
    return { rows: snapshot?.performance ?? [], previous: snapshot?.previousPerformance ?? [], start: filters.start, end: filters.end, loading: false, error: "" };
  }
  const { start, end } = monthRange(month);
  const ready = fetched?.key === key;
  return { rows: ready ? fetched!.rows : [], previous: ready ? fetched!.previous : [], start, end, loading: !ready && !error, error };
}

/** Hover details for a chart point, in the same box the traffic chart uses. `x`/`y` are 0–100 % of the chart. */
export function ChartTip({ x, y, title, rows }: {
  x: number;
  y?: number;
  title: string;
  rows: { label: string; value: string; swatch?: string; note?: string }[];
}) {
  return (
    <div className="chart-tip" role="status" style={{ left: `${Math.min(84, Math.max(16, x))}%`, ...(y !== undefined && { top: `${y}%` }) }}>
      <strong>{title}</strong>
      {rows.map((r) => (
        <span key={r.label}>
          {r.swatch && <i className={`swatch ${r.swatch}`} />} {r.label} <b>{r.value}</b>
          {r.note && <em>{r.note}</em>}
        </span>
      ))}
    </div>
  );
}
