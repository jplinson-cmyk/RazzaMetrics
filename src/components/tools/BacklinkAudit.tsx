import { BacklinkActions } from "../common/RecordActions";
import { BacklinkCharts } from "../explorer/BacklinkCharts";
import { display } from "../../services/measurements";
import { TablePager } from "../common/TablePager";
import { ToolInsights } from "../common/ToolInsights";
import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import { exportToCsv } from "../../utils/csvExport";
import { BacklinkImportModal } from "../integrations/BacklinkImportModal";
import {
  Link2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
  Ban,
  Globe,
  Sparkles,
  Upload,
  Info,
} from "lucide-react";
import { BacklinkItem } from "../../types/seo";

export const BacklinkAudit: React.FC = () => {
  const { backlinks, updateBacklinkDisavow, currentProject, reloadBacklinks } =
    useProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "dofollow" | "nofollow">(
    "all",
  );
  const [filterRisk, setFilterRisk] = useState<"all" | "clean" | "toxic">(
    "all",
  );
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedBacklink, setSelectedBacklink] = useState<BacklinkItem | null>(
    null,
  );

  const dofollowCount = backlinks.filter(
    (b) => b.linkType === "dofollow",
  ).length;
  const nofollowCount = backlinks.filter(
    (b) => b.linkType === "nofollow",
  ).length;
  const dofollowPercent = Math.round(
    (dofollowCount / (backlinks.length || 1)) * 100,
  );

  const avgAuthority = Math.round(
    backlinks.reduce((acc, b) => acc + b.authorityScore, 0) /
      (backlinks.length || 1),
  );

  const filtered = backlinks.filter((b) => {
    const matchesSearch =
      b.sourceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.anchorText.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === "all" || b.linkType === filterType;
    const matchesRisk =
      filterRisk === "all" ||
      (filterRisk === "clean" && b.toxicityScore < 30) ||
      (filterRisk === "toxic" && b.toxicityScore >= 30);

    return matchesSearch && matchesType && matchesRisk;
  });

  const handleExportCsv = () => {
    const exportData = filtered.map((b) => ({
      Platform: "Razza Metrics",
      Project: currentProject.name,
      Domain: currentProject.domain,
      ReportDate: new Date().toISOString(),
      DataRange:
        document
          .querySelector("[data-report-range]")
          ?.getAttribute("data-report-range") || "Stored measurements",
      DataSource:
        "Imported backlink observations; Razza heuristic, not Google toxicity",
      SourceTitle: b.sourceTitle,
      SourceURL: b.sourceUrl,
      TargetURL: b.targetUrl,
      AnchorText: b.anchorText,
      AuthorityScore: b.authorityScore,
      LinkType: b.linkType,
      ToxicityScore: `${display(b.toxicityScore)}/100`,
      DisavowStatus: b.disavowStatus,
      FirstSeen: b.firstSeen,
      LastSeen: b.lastSeen,
    }));
    exportToCsv(`backlinks-audit-${currentProject.domain}`, exportData);
  };

  const getToxicityPill = (score: number) => {
    if (!Number.isFinite(score))
      return <span className="text-gray-400">Not evaluated</span>;
    if (score >= 60) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
          Toxic ({score})
        </span>
      );
    }
    if (score >= 30) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
          Suspicious ({score})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
        Low risk ({score})
      </span>
    );
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Audit referring inbound domains, assess link equity, and inspect
            dofollow/nofollow distributions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95"
            title="Import Google Search Console Links CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Import GSC Backlinks</span>
          </button>
          <ExportButton
            onClick={handleExportCsv}
            label="Export Backlinks CSV"
          />
        </div>
      </div>

      <BacklinkCharts />
      <ToolInsights tool="backlinks" />
      <BacklinkActions />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Backlinks
          </span>
          <div className="text-2xl font-bold font-heading text-gray-900 dark:text-white mt-1">
            {backlinks.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Across {currentProject.referringDomainsCount} referring domains
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Open PageRank (optional)
          </span>
          <div className="text-2xl font-bold font-heading text-razza-600 dark:text-razza-400 mt-1">
            Not Available
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Optional authority enrichment is disabled
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Dofollow Ratio
          </span>
          <div className="text-2xl font-bold font-heading text-sky-600 dark:text-sky-400 mt-1">
            {dofollowCount + nofollowCount ? `${dofollowPercent}%` : "Unknown"}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {dofollowCount} dofollow / {nofollowCount} nofollow
          </p>
        </div>

        <div className="tool-panel p-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Selected for review
          </span>
          <div className="text-2xl font-bold font-heading text-rose-600 dark:text-rose-400 mt-1">
            {
              backlinks.filter(
                (b) =>
                  b.disavowStatus === "disavow-domain" ||
                  b.disavowStatus === "disavow-link",
              ).length
            }
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Excluded from Google ranking
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="tool-panel flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search source title, URL, or anchor text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Link Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
          >
            <option value="all">All Link Types</option>
            <option value="dofollow">Dofollow</option>
            <option value="nofollow">Nofollow</option>
          </select>

          {/* Risk Filter */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
          >
            <option value="all">All Toxicity Levels</option>
            <option value="clean">Clean (Score &lt; 30)</option>
            <option value="toxic">Toxic / Suspicious (30+)</option>
          </select>
        </div>
      </div>

      {/* Backlinks Table */}
      <div className="tool-panel overflow-hidden">
        <div className="overflow-x-auto">
          <TablePager page={page} total={filtered.length} onChange={setPage} />
          <table className="tool-table tool-table w-full text-left text-xs">
            <thead className="tool-thead">
              <tr>
                <th className="px-4 py-3">Source Page &amp; Referring URL</th>
                <th className="px-3 py-3">Anchor Text</th>
                <th className="px-3 py-3 text-center">Auth. Score</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Toxicity</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Disavow Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-gray-400 text-xs"
                  >
                    No backlinks found matching your filters.
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
                  .map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-dark-hover/40 transition-colors"
                    >
                      {/* Source Page */}
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-bold text-gray-900 dark:text-white truncate">
                          {b.sourceTitle}
                        </div>
                        <a
                          href={b.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-razza-600 dark:text-razza-400 hover:underline text-[11px] truncate flex items-center gap-1 font-mono mt-0.5"
                        >
                          <span className="truncate">{b.sourceUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>

                      {/* Anchor */}
                      <td className="px-3 py-3 min-w-[160px]">
                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-dark-surface text-gray-800 dark:text-gray-200 font-mono text-[11px] block truncate">
                          "{b.anchorText}"
                        </span>
                      </td>

                      {/* Authority Score */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded font-heading font-bold text-xs bg-gray-100 dark:bg-dark-border text-gray-800 dark:text-gray-200">
                          {display(b.authorityScore)}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            b.linkType === "dofollow"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-600 dark:bg-dark-border dark:text-gray-400"
                          }`}
                        >
                          {b.linkType}
                        </span>
                      </td>

                      {/* Toxicity */}
                      <td className="px-3 py-3">
                        <button onClick={() => setSelectedBacklink(b)}>
                          {getToxicityPill(b.toxicityScore)}
                        </button>
                      </td>

                      {/* Disavow Status */}
                      <td className="px-3 py-3">
                        {b.disavowStatus === "disavow-domain" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1 w-max">
                            <Ban className="w-3 h-3" />
                            Domain selected for review
                          </span>
                        ) : b.disavowStatus === "disavow-link" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 flex items-center gap-1 w-max">
                            <Ban className="w-3 h-3" />
                            URL selected for review
                          </span>
                        ) : b.disavowStatus === "whitelisted" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1 w-max">
                            <CheckCircle className="w-3 h-3" />
                            Whitelisted
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Action Dropdown */}
                      <td className="px-3 py-3 text-right">
                        <select
                          value={b.disavowStatus}
                          onChange={(e) =>
                            updateBacklinkDisavow(b.id, e.target.value as any)
                          }
                          className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
                        >
                          <option value="none">Keep Active</option>
                          <option value="disavow-link">
                            Select URL for review
                          </option>
                          <option value="disavow-domain">
                            Select domain for review
                          </option>
                          <option value="whitelisted">Whitelist</option>
                        </select>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backlink Import Modal */}
      <BacklinkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={currentProject.id}
        onImportComplete={() => {
          if (reloadBacklinks) reloadBacklinks();
        }}
      />

      {/* Risk Details Modal */}
      {selectedBacklink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="tool-panel relative w-full max-w-md p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-heading text-gray-900 dark:text-white">
                Backlink Risk Breakdown
              </h3>
              <button
                onClick={() => setSelectedBacklink(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-gray-400">
                  Source URL
                </span>
                <p className="font-mono text-[11px] text-gray-800 dark:text-gray-200 break-all mt-0.5">
                  {selectedBacklink.sourceUrl}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
                  <span className="text-[10px] font-bold text-gray-400 block">
                    Toxicity Score
                  </span>
                  <span className="text-sm font-bold font-heading text-gray-900 dark:text-white mt-0.5 block">
                    {display(selectedBacklink.toxicityScore)}/100
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
                  <span className="text-[10px] font-bold text-gray-400 block">
                    Authority Score
                  </span>
                  <span className="text-sm font-bold font-heading text-gray-900 dark:text-white mt-0.5 block">
                    {display(selectedBacklink.authorityScore)}/10
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">
                  Detected Risk Markers
                </span>
                {selectedBacklink.toxicMarkers &&
                selectedBacklink.toxicMarkers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedBacklink.toxicMarkers.map((marker, mIdx) => (
                      <span
                        key={mIdx}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                      >
                        {marker}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    No harmful markers detected. Link is considered clean.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBacklink(null)}
                className="px-4 py-1.5 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
