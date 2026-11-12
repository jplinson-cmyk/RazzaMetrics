import { KeywordEvidence } from "../common/RecordActions";
import { display } from "../../services/measurements";
import { TablePager } from "../common/TablePager";
import { KeywordDrawer } from "../common/KeywordDrawer";
import React, { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import {
  RankTrendChart,
  RankingDistributionBar,
} from "../common/ChartComponents";
import { exportToCsv } from "../../utils/csvExport";
import {
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Trash2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Layers,
  MapPin,
  Monitor,
  ExternalLink,
  RefreshCw,
  Chrome,
} from "lucide-react";
import { TrackedKeyword } from "../../types/seo";
import { syncKeywordPerformance } from "../../services/searchConsole";
import { MonthFilter, monthsIn } from "../explorer/MonthFilter";

export const KeywordRanking: React.FC = () => {
  const {
    keywords,
    addTrackedKeyword,
    deleteTrackedKeyword,
    currentProject,
    reload,
  } = useProject();

  useEffect(() => {
    setSelectedKeywordForChart(keywords[0]);
  }, [currentProject.id, keywords]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort,setSort]=useState('keyword');
  const [drawer, setDrawer] = useState(false);
  const [selectedKeywordForChart, setSelectedKeywordForChart] =
    useState<TrackedKeyword>(keywords[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [newKeywordLocation, setNewKeywordLocation] = useState("United States");
  const [newKeywordTag, setNewKeywordTag] = useState("Priority");
  const [isSyncingGsc, setIsSyncingGsc] = useState(false);
  const [gscNotice, setGscNotice] = useState<string | null>(null);

  // The breakdown has its own month: each keyword's last recorded position in that month.
  const [rankMonth, setRankMonth] = useState("");
  const rankMonths = monthsIn(keywords.flatMap((k) => k.historyDates || []));
  const ranks = keywords
    .map((k) => {
      if (!rankMonth) return k.currentRank;
      const i = (k.historyDates || []).map((d) => d.startsWith(rankMonth)).lastIndexOf(true);
      return i < 0 ? NaN : k.history[i];
    })
    .filter(Number.isFinite);
  const top3 = ranks.filter((r) => r <= 3).length;
  const top10 = ranks.filter((r) => r > 3 && r <= 10).length;
  const top20 = ranks.filter((r) => r > 10 && r <= 20).length;
  const top50 = ranks.filter((r) => r > 20 && r <= 50).length;
  const top100 = ranks.filter((r) => r > 50).length;

  const filteredKeywords = keywords.filter(
    (k) =>
      k.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  ).sort((a,b)=>sort==='position'?(Number.isFinite(a.currentRank)?a.currentRank:Infinity)-(Number.isFinite(b.currentRank)?b.currentRank:Infinity):sort==='clicks'?(b.clicks||0)-(a.clicks||0):sort==='impressions'?(b.impressions||0)-(a.impressions||0):sort==='change'?(Number.isFinite(b.change)?b.change:-Infinity)-(Number.isFinite(a.change)?a.change:-Infinity):a.keyword.localeCompare(b.keyword));

  const handleCreateKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    addTrackedKeyword(newKeywordInput.trim(), newKeywordLocation, [
      newKeywordTag,
    ]);
    setNewKeywordInput("");
    setIsAddModalOpen(false);
  };

  const handleExportCsv = () => {
    const exportData = filteredKeywords.map((k) => ({
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
      CurrentRank: k.currentRank,
      PreviousRank: k.previousRank,
      Change: k.change > 0 ? `+${k.change}` : k.change,
      SearchClicks: k.clicks,
      TargetUrl: k.url,
      Location: k.location,
      Device: k.device,
      Tags: k.tags.join("; "),
    }));
    exportToCsv(`keyword-rankings-${currentProject.domain}`, exportData);
  };

  const handleGscSync = async () => {
    setIsSyncingGsc(true);
    setGscNotice(null);

    const siteUrl =
      currentProject.gscProperty || `https://${currentProject.domain}/`;
    if (!currentProject.gscProperty) {
      setIsSyncingGsc(false);
      setGscNotice(
        'Google account is not connected. Click "GSC" in the top navbar to authenticate with Google Search Console.',
      );
      return;
    }

    try {
      const res = await syncKeywordPerformance(
        currentProject.id,
        siteUrl,
        90,
        (msg) => setGscNotice(msg),
      );
      await reload();
      if (res.errors.length > 0) {
        setGscNotice(`Synced ${res.synced} records. Warning: ${res.errors[0]}`);
      } else {
        setGscNotice(
          `Synchronization queued (${res.jobId}). Progress and errors appear in the saved jobs panel.`,
        );
      }
    } catch (err) {
      setGscNotice(
        err instanceof Error ? err.message : "GSC sync encountered an error.",
      );
    } finally {
      setIsSyncingGsc(false);
    }
  };

  const getDifficultyColor = (kd: number) => {
    if (kd < 30)
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200";
    if (kd < 60)
      return "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200";
    return "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200";
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Inspect stored Search Console average positions and changes for
            tracked queries
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGscSync}
            disabled={isSyncingGsc}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Sync real data from Google Search Console"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-blue-600 ${isSyncingGsc ? "animate-spin" : ""}`}
            />
            <span>{isSyncingGsc ? "Syncing GSC..." : "Sync GSC Data"}</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Track New Keyword</span>
          </button>
          <ExportButton onClick={handleExportCsv} label="Export Rankings CSV" />
        </div>
      </div>
      <KeywordDrawer
        keyword={selectedKeywordForChart?.keyword || ""}
        open={drawer}
        onClose={() => setDrawer(false)}
      />

      {gscNotice && (
        <div className="tool-note text-xs flex items-center justify-between">
          <span>{gscNotice}</span>
          <button
            onClick={() => setGscNotice(null)}
            className="text-blue-600 hover:underline text-[11px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Visual Analytics Row: SERP Distribution + Interactive Keyword Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SERP Distribution */}
        <div className="tool-panel lg:col-span-5 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-heading font-bold text-sm text-gray-900 dark:text-white">
              Position Breakdown
            </h3>
            {rankMonths.length > 0 && <MonthFilter value={rankMonth} onChange={setRankMonth} months={rankMonths} allLabel="Latest" />}
          </div>
          <RankingDistributionBar
            top3={top3}
            top10={top10}
            top20={top20}
            top50={top50}
            top100={top100}
          />
        </div>

        {/* Selected Keyword Trend Curve */}
        <div className="tool-panel lg:col-span-7 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-bold text-sm text-gray-900 dark:text-white">
              Average position history
            </h3>
            <span className="text-[11px] text-gray-400">
              Click any keyword row below to inspect
            </span>
          </div>

          {selectedKeywordForChart ? (
            <RankTrendChart
              data={selectedKeywordForChart.history}
              keyword={selectedKeywordForChart.keyword}
              labels={selectedKeywordForChart.historyDates}
            />
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400">
              Select a keyword to view historical movement
            </div>
          )}
        </div>
      </div>

      {/* Keyword Table Controls */}
      <div className="tool-panel flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracked keywords or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
          />
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Showing <strong>{filteredKeywords.length}</strong> of{" "}
          <strong>{keywords.length}</strong> tracked keywords
        </div>
      </div>

      <KeywordEvidence keyword={selectedKeywordForChart?.keyword} />
      {/* Rankings Data Table */}
      <div className="tool-panel overflow-hidden">
        <div className="overflow-x-auto">
          <TablePager
            page={page}
            total={filteredKeywords.length}
            onChange={setPage}
          />
          <label className="block px-4 pb-3 text-xs text-slate-500">Sort keywords <select aria-label="Sort tracked keywords" className="ml-2 border rounded-lg p-2 dark:bg-dark-surface" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="keyword">Keyword A–Z</option><option value="position">Best average position</option><option value="clicks">Highest clicks</option><option value="impressions">Highest impressions</option><option value="change">Largest improvement</option></select></label>
          <table className="tool-table tool-table w-full text-left text-xs">
            <thead className="tool-thead">
              <tr>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-3 py-3 text-center">Avg. position</th>
                <th className="px-3 py-3 text-center">Change</th>
                <th className="px-3 py-3">Clicks</th>
                <th className="px-3 py-3">Impressions</th>
                <th className="px-3 py-3">CTR</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filteredKeywords.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-gray-400 text-xs"
                  >
                    No keywords found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredKeywords
                  .slice(
                    (Math.min(
                      page,
                      Math.max(1, Math.ceil(filteredKeywords.length / 25)),
                    ) -
                      1) *
                      25,
                    Math.min(
                      page,
                      Math.max(1, Math.ceil(filteredKeywords.length / 25)),
                    ) * 25,
                  )
                  .map((kw) => {
                    const isSelected = selectedKeywordForChart?.id === kw.id;
                    return (
                      <tr
                        key={kw.id}
                        tabIndex={0}
                        aria-label={`View details for ${kw.keyword}`}
                        onKeyDown={(e) => {
                          if (
                            e.target === e.currentTarget &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            setSelectedKeywordForChart(kw);
                            setDrawer(true);
                          }
                        }}
                        onClick={() => {
                          setSelectedKeywordForChart(kw);
                          setDrawer(true);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-razza-50/50 dark:bg-razza-900/10"
                            : "hover:bg-gray-50/70 dark:hover:bg-dark-hover/40"
                        }`}
                      >
                        {/* Keyword Title & URL */}
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {kw.keyword}
                            </span>
                            {kw.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-300 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5 flex items-center gap-1 font-mono">
                            <span>{kw.url}</span>
                          </div>
                        </td>

                        {/* Current Rank */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-heading font-black text-sm ${
                              kw.currentRank <= 3
                                ? "bg-razza-500 text-white shadow-glow-sm"
                                : kw.currentRank <= 10
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-dark-border dark:text-gray-200"
                            }`}
                          >
                            {display(kw.currentRank)}
                          </span>
                        </td>

                        {/* Change */}
                        <td className="px-3 py-3 text-center">
                          {kw.change > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <ArrowUp className="w-3.5 h-3.5" />+
                              {display(kw.change)}
                            </span>
                          ) : kw.change < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                              <ArrowDown className="w-3.5 h-3.5" />
                              {display(kw.change)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-gray-400">
                              <Minus className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>

                        {/* Search Volume */}
                        <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-200">
                          {display(kw.clicks)}
                        </td>

                        {/* Difficulty (KD) */}
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${getDifficultyColor(kw.difficulty)}`}
                          >
                            {display(kw.impressions)}
                          </span>
                        </td>

                        {/* CPC */}
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300 font-mono">
                          {display(kw.ctr)}%
                        </td>

                        {/* SERP Features */}
                        <td className="px-3 py-3 min-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {["Google Search Console"].map((feat, fIdx) => (
                              <span
                                key={fIdx}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-surface text-gray-600 dark:text-gray-300 font-medium"
                              >
                                {feat}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTrackedKeyword(kw.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Stop tracking keyword"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Keyword Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="tool-panel relative w-full max-w-md p-4 shadow-2xl space-y-4">
            <h3 className="text-base font-bold font-heading text-gray-900 dark:text-white">
              Track New Target Keyword
            </h3>

            <form onSubmit={handleCreateKeyword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Keyword
                </label>
                <input
                  type="text"
                  placeholder="e.g. b2b marketing consulting"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <select
                    value={newKeywordLocation}
                    onChange={(e) => setNewKeywordLocation(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Global">Global</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tag / Cluster
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Core Services"
                    value={newKeywordTag}
                    onChange={(e) => setNewKeywordTag(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm"
                >
                  Start Tracking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
