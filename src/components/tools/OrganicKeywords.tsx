import { display } from "../../services/measurements";
import { KeywordCharts } from "../explorer/KeywordCharts";
import { TablePager } from "../common/TablePager";
import { KeywordEvidence } from "../common/RecordActions";
import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import { exportToCsv } from "../../utils/csvExport";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Layers,
  Compass,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Plus,
  Check,
} from "lucide-react";
import { SearchIntent } from "../../types/seo";

export const OrganicKeywords: React.FC = () => {
  const { organicKeywords, currentProject, addTrackedKeyword } = useProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIntent, setSelectedIntent] = useState<SearchIntent | "all">(
    "all",
  );
  const [positionFilter, setPositionFilter] = useState<
    "all" | "top3" | "top10" | "top20"
  >("all");
  const [addedKeyword, setAddedKeyword] = useState<string | null>(null);
  const [minimumClicks, setMinimumClicks] = useState(0);
  const [minimumImpressions, setMinimumImpressions] = useState(0);
  const [pageFilter, setPageFilter] = useState("");
  const [sort, setSort] = useState("clicks");
  const [detailKeyword, setDetailKeyword] = useState<string>();
  const [chip, setChip] = useState("all");

  const filtered = organicKeywords
    .filter((kw) => {
      const matchesSearch =
        kw.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kw.url.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIntent =
        selectedIntent === "all" || kw.intent === selectedIntent;

      let matchesPos = true;
      if (positionFilter === "top3") matchesPos = kw.position <= 3;
      if (positionFilter === "top10") matchesPos = kw.position <= 10;
      if (positionFilter === "top20") matchesPos = kw.position <= 20;

      return (
        matchesSearch &&
        matchesIntent &&
        matchesPos &&
        kw.trafficEstimate >= minimumClicks &&
        kw.volume >= minimumImpressions &&
        kw.url.includes(pageFilter) &&
        (chip === "all" ||
          (chip === "clicks" && kw.trafficEstimate > 0) ||
          (chip === "impressions" && kw.volume >= 100) ||
          (chip === "ctr" &&
            kw.volume >= 100 &&
            kw.trafficEstimate / kw.volume < 0.02) ||
          (chip === "improving" && kw.previousPosition > kw.position) ||
          (chip === "declining" && kw.previousPosition < kw.position))
      );
    })
    .sort((a, b) =>
      sort === "position"
        ? a.position - b.position
        : sort === "impressions"
          ? b.volume - a.volume
          : sort === "ctr"
            ? a.trafficEstimate / Math.max(1, a.volume) -
              b.trafficEstimate / Math.max(1, b.volume)
            : sort === "movement"
              ? b.previousPosition -
                b.position -
                (a.previousPosition - a.position)
              : b.trafficEstimate - a.trafficEstimate,
    );

  const totalOrganicTraffic = organicKeywords.reduce(
    (acc, k) => acc + k.trafficEstimate,
    0,
  );

  const handleExportCsv = () => {
    const exportData = filtered.map((k) => ({
      Platform: "Razza Metrics",
      Project: currentProject.name,
      Domain: currentProject.domain,
      ReportDate: new Date().toISOString(),
      DataRange:
        document
          .querySelector("[data-report-range]")
          ?.getAttribute("data-report-range") || "Stored measurements",
      DataSource:
        "Google Search Console average position; incomplete top-query data",
      Keyword: k.keyword,
      AveragePosition: k.position,
      Clicks: k.trafficEstimate,
      Impressions: k.volume,
      ClickSharePercentage: `${k.trafficPercentage}%`,
      SERPUrl: k.url,
    }));
    exportToCsv(`organic-research-${currentProject.domain}`, exportData);
  };

  const getIntentBadge = (intent: SearchIntent) => {
    switch (intent) {
      case "Informational":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200";
      case "Commercial":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200";
      case "Transactional":
        return "bg-razza-50 text-razza-700 dark:bg-razza-950/50 dark:text-razza-300 border-razza-200";
      case "Navigational":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200";
    }
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Discover which keywords bring organic traffic to{" "}
            {currentProject.domain} from stored Search Console measurements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExportCsv} label="Export Organic CSV" />
        </div>
      </div>

      <KeywordCharts />
      <div className="chart-toolbar" aria-label="Organic query quick filters">
        {[
          ["all", "All queries"],
          ["clicks", "With clicks"],
          ["impressions", "100+ impressions"],
          ["ctr", "Low CTR"],
          ["improving", "Improving"],
          ["declining", "Declining"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={chip === id ? "selected" : ""}
            onClick={() => {
              setChip(id);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
        <p className="text-xs text-slate-500">
          Low CTR: 100+ impressions and fewer than 2% clicks. Review relevance
          and search presentation; this is not a traffic forecast.
        </p>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Organic Keywords
          </span>
          <div className="text-2xl font-bold font-heading text-gray-900 dark:text-white mt-1">
            {organicKeywords.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Queries returned by Google
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Measured Clicks
          </span>
          <div className="text-2xl font-bold font-heading text-razza-600 dark:text-razza-400 mt-1">
            {totalOrganicTraffic.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Source: Google Search Console
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Intent classification
          </span>
          <div className="text-2xl font-bold font-heading text-amber-600 dark:text-amber-400 mt-1">
            Not Available
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Not supplied by Search Console
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Top 3 Rankings
          </span>
          <div className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
            {organicKeywords.filter((k) => k.position <= 3).length}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Maximum SERP visibility
          </p>
        </div>
      </div>

      <div className="tool-panel flex flex-wrap gap-3 p-4 text-xs text-gray-500">
        <label>
          Minimum clicks{" "}
          <input
            type="number"
            min={0}
            aria-label="Minimum clicks"
            value={minimumClicks}
            onChange={(e) => setMinimumClicks(Number(e.target.value))}
            className="w-24 p-2 rounded border dark:bg-dark-surface"
          />
        </label>
        <label>
          Minimum impressions{" "}
          <input
            type="number"
            min={0}
            aria-label="Minimum impressions"
            value={minimumImpressions}
            onChange={(e) => setMinimumImpressions(Number(e.target.value))}
            className="w-24 p-2 rounded border dark:bg-dark-surface"
          />
        </label>
        <input
          aria-label="Page URL filter"
          placeholder="Page URL contains…"
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          className="p-2 rounded border dark:bg-dark-surface"
        />
        <select
          aria-label="Organic keyword sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="p-2 rounded border dark:bg-dark-surface"
        >
          <option value="clicks">Highest clicks</option>
          <option value="impressions">Highest impressions</option>
          <option value="position">Best average position</option>
          <option value="ctr">Lowest CTR</option>
          <option value="movement">Improvement vs previous period</option>
        </select>
      </div>
      {/* Intent & Position Filter Tabs */}
      <div className="tool-panel flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search keywords or URLs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Intent Filters */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-dark-border p-0.5 bg-gray-50 dark:bg-dark-surface text-xs">
            {(["all"] as const).map((intent) => (
              <button
                key={intent}
                onClick={() => setSelectedIntent(intent as any)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedIntent === intent
                    ? "bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm font-semibold"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                {intent === "all" ? "All queries" : intent}
              </button>
            ))}
          </div>

          {/* Position Range */}
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
          >
            <option value="all">Positions: All</option>
            <option value="top3">Top 3 Only</option>
            <option value="top10">Top 10</option>
            <option value="top20">Top 20</option>
          </select>
        </div>
      </div>

      <KeywordEvidence keyword={detailKeyword} />
      {/* Organic Keyword Table */}
      <div className="tool-panel overflow-hidden">
        <div className="overflow-x-auto">
          <TablePager page={page} total={filtered.length} onChange={setPage} />
          <table className="tool-table tool-table w-full text-left text-xs">
            <thead className="tool-thead">
              <tr>
                <th className="px-4 py-3">Organic Keyword</th>
                <th className="px-3 py-3">Intent</th>
                <th className="px-3 py-3 text-center">Avg. position</th>
                <th className="px-3 py-3">Clicks</th>
                <th className="px-3 py-3">Traffic %</th>
                <th className="px-3 py-3">Impressions</th>
                <th className="px-3 py-3">Difficulty unavailable</th>
                <th className="px-3 py-3">CPC unavailable</th>
                <th className="px-3 py-3">Destination URL</th>
                <th className="px-3 py-3 text-right">Track</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-8 text-gray-400 text-xs"
                  >
                    No organic keywords match the filter criteria.
                  </td>
                </tr>
              ) : (
                filtered
                  .slice(
                    (Math.min(
                      page,
                      Math.max(1, Math.ceil(filtered.length / 25)),
                    ) -
                      1) *
                      25,
                    Math.min(
                      page,
                      Math.max(1, Math.ceil(filtered.length / 25)),
                    ) * 25,
                  )
                  .map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-dark-hover/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white min-w-[200px]">
                        <button onClick={() => setDetailKeyword(item.keyword)}>
                          {item.keyword}
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getIntentBadge(item.intent)}`}
                        >
                          Not Available
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center gap-1 font-heading font-black text-sm">
                          <span
                            className={
                              item.position <= 3
                                ? "text-razza-600 dark:text-razza-400"
                                : "text-gray-800 dark:text-gray-200"
                            }
                          >
                            {display(item.position)}
                          </span>
                          {item.position < item.previousPosition ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                          ) : item.position > item.previousPosition ? (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <Minus className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">
                        {item.trafficEstimate.toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 bg-gray-200 dark:bg-dark-border h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-razza-500 h-full rounded-full"
                              style={{ width: `${item.trafficPercentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px]">
                            {item.trafficPercentage}%
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {item.volume.toLocaleString()}
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-bold text-[11px] text-gray-700 dark:text-gray-300">
                          {display(item.kd)}%
                        </span>
                      </td>

                      <td className="px-3 py-3 font-mono text-gray-600 dark:text-gray-400">
                        ${display(item.cpc)}
                      </td>

                      <td className="px-3 py-3 max-w-[220px]">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-razza-600 dark:text-razza-400 hover:underline truncate block font-mono text-[11px]"
                        >
                          {item.url}
                        </a>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            addTrackedKeyword(item.keyword, "United States", [
                              "Discovered",
                            ]);
                            setAddedKeyword(item.keyword);
                            setTimeout(() => setAddedKeyword(null), 2000);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-razza-50 hover:bg-razza-100 dark:bg-razza-950/40 dark:hover:bg-razza-900/60 text-razza-700 dark:text-razza-300 text-[11px] font-semibold border border-razza-200 dark:border-razza-800/40 transition-colors active:scale-95"
                          title="Add to Tracked Keywords"
                        >
                          {addedKeyword === item.keyword ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Tracked!</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Track</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
