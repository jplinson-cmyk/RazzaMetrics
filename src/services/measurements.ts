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
