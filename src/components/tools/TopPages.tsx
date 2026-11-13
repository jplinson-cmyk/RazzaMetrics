import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { MonthFilter, recentMonths, useSearchRows } from "../explorer/MonthFilter";
import { aggregate, display } from "../../services/measurements";
import { abbreviate, delta, topPages, urlPath, type PageRow } from "../../services/explorer";
import { TablePager } from "../common/TablePager";
import { PositionBadge } from "../common/PremiumDashboard";
import { DeltaBadge, Truncate, WidgetState } from "../explorer/ui";

type SortKey = "page" | "clicks" | "impressions" | "keywords" | "position" | "change";
const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "page", label: "Page" },
  { key: "clicks", label: "Traffic", num: true },
  { key: "change", label: "Change", num: true },
  { key: "impressions", label: "Impressions", num: true },
  { key: "keywords", label: "Keywords", num: true },
  { key: "position", label: "Avg. position", num: true },
];
const PAGE_SIZE = 25;

export const TopPages: React.FC = () => {
  const { snapshot, refreshing, error, reload } = useProject();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "clicks", dir: -1 });
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState("");
  const src = useSearchRows(month);

  const rows = useMemo(() => (snapshot ? topPages(src.rows, src.previous) : []), [snapshot, src.rows, src.previous]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (r: PageRow) =>
      sort.key === "page" ? r.page : sort.key === "change" ? delta(r.clicks, r.previousClicks) : r[sort.key];
    return rows
      .filter((r) => !q || r.page.toLowerCase().includes(q) || r.topKeyword.toLowerCase().includes(q))
      .sort((a, b) => {
        const x = value(a), y = value(b);
        if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * sort.dir;
        // Missing values sort last in either direction.
        if (!Number.isFinite(x)) return 1;
        if (!Number.isFinite(y)) return -1;
        return (x - y) * sort.dir;
      });
  }, [rows, query, sort]);

  if (!snapshot && error) {
    return <section className="card"><WidgetState kind="error" title="Pages could not load" body={error} onRetry={() => void reload()} /></section>;
  }
  const total = aggregate(src.rows);
  const ranked = rows.filter((r) => r.clicks > 0).length;

  return (
    <div className={`tool-screen ${refreshing ? "is-refreshing" : ""}`}>
      <div className="tool-header">
        <p className="tool-intro">Every page Google showed for this site in the period, ranked by clicks from Search Console.</p>
        <MonthFilter value={month} onChange={(m) => { setMonth(m); setPage(1); }} months={recentMonths()} />
      </div>
      {src.error && <WidgetState kind="error" title="This month could not load" body={src.error} />}
      {src.loading && <p className="chart-loading" role="status">Loading month…</p>}

      <dl className="summary-strip" aria-label="Page summary">
        <div><dt>Pages with impressions</dt><dd>{rows.length.toLocaleString()}</dd></div>
        <div><dt>Pages with clicks</dt><dd>{ranked.toLocaleString()}</dd></div>
        <div><dt>Total traffic</dt><dd>{rows.length ? abbreviate(total.clicks) : "No Data"}</dd></div>
        <div><dt>Avg. position</dt><dd>{display(total.position)}</dd></div>
      </dl>

      <section className="card" aria-labelledby="pages-title">
        <header className="card-head">
          <h2 id="pages-title">Top pages</h2>
          <label className="table-search">
            <Search className="w-4 h-4" aria-hidden="true" />
            <span className="visually-hidden">Search pages or keywords</span>
            <input
              type="search"
              placeholder="Filter by URL or keyword"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </header>
        {!rows.length ? (
          <WidgetState kind="empty" title="No pages with search data in this period" body="Sync Search Console or widen the timeframe in the bar above." />
        ) : !shown.length ? (
          <WidgetState
            kind="empty"
            title={`No pages match "${query}"`}
            action={<button type="button" className="btn-secondary" onClick={() => setQuery("")}>Clear filter</button>}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table--full">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={c.num ? "num" : undefined}
                        aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === "page" || c.key === "position" ? 1 : -1 }))}
                        >
                          {c.label}
                          <span className="sort-mark" aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                    ))}
                    <th scope="col">Top keyword</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                    <tr key={r.page}>
                      <td className="cell-url"><Truncate text={urlPath(r.page)} className="mono" /></td>
                      <td className="num">{r.clicks.toLocaleString()}</td>
                      <td className="num"><DeltaBadge value={delta(r.clicks, r.previousClicks)} /></td>
                      <td className="num">{r.impressions.toLocaleString()}</td>
                      <td className="num">{r.keywords.toLocaleString()}</td>
                      <td className="num"><PositionBadge position={r.position} /></td>
                      <td className="cell-text"><Truncate text={r.topKeyword} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager page={page} total={shown.length} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
};
