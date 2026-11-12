export interface PerformanceRow {
  keyword: string;
  page: string;
  date: string;
  clicks: number;
  impressions: number;
  position: number;
  device: string;
  country: string;
}
/** Column order of the compact Search Console rows the server sends. */
export const PERF_COLUMNS = ["keyword", "page", "date", "device", "country", "clicks", "impressions", "position"] as const;
type Cell = string | number;
/** Compact rows (arrays in PERF_COLUMNS order) back to objects. Older object rows pass through. */
export function unpackRows(rows: (Cell[] | PerformanceRow)[] | undefined): PerformanceRow[] {
  return (rows || []).map((r) =>
    Array.isArray(r)
      ? { keyword: String(r[0]), page: String(r[1]), date: String(r[2]), device: String(r[3]), country: String(r[4]), clicks: Number(r[5]), impressions: Number(r[6]), position: Number(r[7]) }
      : r,
  );
}
export function aggregate(records: PerformanceRow[]) {
  const clicks = records.reduce((n, r) => n + r.clicks, 0);
  const impressions = records.reduce((n, r) => n + r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? (clicks / impressions) * 100 : Number.NaN,
    position: impressions
      ? records.reduce((n, r) => n + r.impressions * r.position, 0) /
        impressions
      : Number.NaN,
  };
}
export const display = (n: number | undefined | null, digits = 1) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "No Data";
