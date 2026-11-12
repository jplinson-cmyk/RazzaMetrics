import { MonthFilter, monthsIn } from "../explorer/MonthFilter";
import { ToxicityHistory } from "../common/RecordActions";
import { ToolInsights } from "../common/ToolInsights";
import { display } from "../../services/measurements";
import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import { exportGoogleDisavowFile } from "../../utils/disavowExport";
import { exportToCsv } from "../../utils/csvExport";
import { ToxicityDonut } from "../common/ChartComponents";
import {
  scoreProject,
  scoreBacklink,
  ToxicityResult,
} from "../../services/toxicityEngine";
import {
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  FileText,
  Download,
  Ban,
  CheckCircle,
  ExternalLink,
  Info,
  Sparkles,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

export const ToxicityScore: React.FC = () => {
  const {
    currentProject,
    backlinks,
    toxicMarkers,
    updateBacklinkDisavow,
    queueJob,
    snapshot,
  } = useProject();

  const [activeView, setActiveView] = useState<"overview" | "disavow">(
    "overview",
  );
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcNotice, setRecalcNotice] = useState<string | null>(null);
  const [inspectedLink, setInspectedLink] = useState<{
    url: string;
    result: ToxicityResult;
  } | null>(null);

  // The donut has its own month: links first seen in that month.
  const [donutMonth, setDonutMonth] = useState("");
  const donutLinks = donutMonth ? backlinks.filter((b) => b.firstSeen?.startsWith(donutMonth)) : backlinks;
  const toxicCount = donutLinks.filter((b) => b.toxicityScore >= 60).length;
  const suspiciousCount = donutLinks.filter(
    (b) => b.toxicityScore >= 30 && b.toxicityScore < 60,
  ).length;
  const cleanCount = donutLinks.filter((b) => b.toxicityScore < 30).length;

  const disavowedCount = backlinks.filter(
    (b) =>
      b.disavowStatus === "disavow-domain" ||
      b.disavowStatus === "disavow-link",
  ).length;

  const handleExportDisavowTxt = () => {
    exportGoogleDisavowFile(currentProject.domain, backlinks);
  };

  const handleExportToxicityCsv = () => {
    const exportData = backlinks.map((b) => ({
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
      ToxicityScore: b.toxicityScore,
      RiskLevel:
        b.toxicityScore >= 60
          ? "High"
          : b.toxicityScore >= 30
            ? "Medium"
            : "Low risk",
      ToxicMarkers: b.toxicMarkers.join("; "),
      DisavowStatus: b.disavowStatus,
    }));
    exportToCsv(`toxicity-audit-${currentProject.domain}`, exportData);
  };

  const handleRecalculateToxicity = async () => {
    setIsRecalculating(true);
    await queueJob("toxicity");
    setRecalcNotice(
      "Recalculation queued. Saved scores and coverage update when processing finishes.",
    );
    setIsRecalculating(false);
  };

  const inspectLink = (sourceUrl: string, anchorText: string) => {
    const stored = snapshot?.backlinks.find(
      (b) =>
        (b.sourceUrl || "") === sourceUrl &&
        (b.anchorText || "") === anchorText,
    );
    if (!stored || stored.riskCategory === "unknown") return;
    const result: ToxicityResult = {
      score: stored.riskScore,
      category: stored.riskCategory,
      signals: JSON.parse(stored.riskSignals || "[]"),
      explanation:
        "Saved assessment using the project rules at calculation time. Unknown attributes are not evidence of safety.",
    };
    setInspectedLink({ url: stored.sourceUrl || stored.sourceDomain, result });
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Review explainable risk signals in imported observations. This
            heuristic cannot predict Google penalties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRecalculateToxicity}
            disabled={isRecalculating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95 disabled:opacity-50"
            title="Recalculate toxicity across all inbound links"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`}
            />
            <span>
              {isRecalculating ? "Recalculating..." : "Recalculate Toxicity"}
            </span>
          </button>
          <button
            onClick={handleExportDisavowTxt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95"
            title="Download formatted disavow.txt for Google Search Console"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export disavow.txt</span>
          </button>
          <ExportButton
            onClick={handleExportToxicityCsv}
            label="Export Toxicity CSV"
          />
        </div>
      </div>
      <ToolInsights tool="toxicity" />
      <ToxicityHistory />

      {recalcNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{recalcNotice}</span>
          <button
            onClick={() => setRecalcNotice(null)}
            className="text-emerald-600 hover:underline text-[11px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Score & Donut Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="tool-panel lg:col-span-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-gray-900 dark:text-white">
                Overall Domain Toxicity Score
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Composite risk calculated across all referring inbound links
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                !Number.isFinite(currentProject.overallToxicityScore)
                  ? "bg-gray-100 text-gray-600 dark:bg-dark-hover dark:text-gray-400 border border-gray-200"
                  : currentProject.overallToxicityScore < 30
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200"
                  : currentProject.overallToxicityScore < 60
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200"
              }`}
            >
              {!Number.isFinite(currentProject.overallToxicityScore)
                ? "Not scored yet"
                : currentProject.overallToxicityScore < 30
                ? "Low Risk Profile"
                : currentProject.overallToxicityScore < 60
                  ? "Medium Risk Profile"
                  : "High Risk Alert"}
            </span>
          </div>

          <div className="flex justify-end">
            <MonthFilter value={donutMonth} onChange={setDonutMonth} months={monthsIn(backlinks.map((b) => b.firstSeen))} allLabel="All dates" />
          </div>
          <div className="py-2">
            <ToxicityDonut
              toxic={toxicCount}
              suspicious={suspiciousCount}
              clean={cleanCount}
              overallScore={currentProject.overallToxicityScore}
            />
          </div>

          {/* Explanation Banner */}
          <div className="mt-4 p-3.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-xs text-gray-600 dark:text-gray-300 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-razza-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Interpretation:</strong> Low scores mean fewer observed
              signals, not proven safety. Review evidence and context. Never
              disavow a link solely because of this score; no requests are
              submitted to Google.
            </div>
          </div>
        </div>

        {/* Toxic Markers Breakdown */}
        <div className="tool-panel lg:col-span-6 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-gray-900 dark:text-white">
                Detected Toxic Markers
              </h3>
              <span className="text-xs text-gray-400">
                {toxicMarkers.length} algorithmic markers
              </span>
            </div>

            <div className="space-y-2.5">
              {toxicMarkers.map((marker) => (
                <div
                  key={marker.code}
                  className="p-3 rounded-xl border border-gray-100 dark:border-dark-border bg-gray-50/70 dark:bg-dark-surface/50 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-gray-400">
                        {marker.code}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {marker.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        marker.severity === "High"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : marker.severity === "Medium"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}
                    >
                      {marker.detectedCount} detected
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                    {marker.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Disavow Manager & Toxic Links Drilldown */}
      <div className="tool-panel p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-dark-border pb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Disavow Management &amp; Toxic Links</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review flagged observations and manually select any records for an
              offline review export ({disavowedCount} selected; nothing
              submitted to Google)
            </p>
          </div>

          <button
            onClick={handleExportDisavowTxt}
            className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download GSC disavow.txt</span>
          </button>
        </div>

        {/* Backlinks with toxic markers */}
        <div className="overflow-x-auto">
          <table className="tool-table tool-table w-full text-left text-xs">
            <thead className="tool-thead">
              <tr>
                <th className="px-4 py-3">Suspicious Referring Page</th>
                <th className="px-3 py-3">Anchor</th>
                <th className="px-3 py-3">Toxicity Score</th>
                <th className="px-3 py-3">Detected Toxic Markers</th>
                <th className="px-3 py-3">Current Status</th>
                <th className="px-3 py-3 text-right">Disavow Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {backlinks
                .filter((b) => b.toxicityScore >= 30)
                .map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-dark-hover/40 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-bold text-gray-900 dark:text-white truncate">
                        {item.sourceTitle}
                      </div>
                      <span className="font-mono text-[11px] text-gray-400 truncate block">
                        {item.sourceUrl}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                        "{item.anchorText}"
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-heading font-bold text-xs text-rose-600 dark:text-rose-400">
                        {display(item.toxicityScore)}/100
                      </span>
                    </td>

                    <td className="px-3 py-3 min-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {item.toxicMarkers.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {item.disavowStatus === "disavow-domain" ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          Domain Disavowed
                        </span>
                      ) : item.disavowStatus === "disavow-link" ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          URL Disavowed
                        </span>
                      ) : item.disavowStatus === "whitelisted" ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          Whitelisted
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">
                          Unresolved
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            inspectLink(item.sourceUrl, item.anchorText)
                          }
                          className="p-1 rounded-lg text-gray-400 hover:text-razza-600 dark:hover:text-razza-400 hover:bg-gray-100 dark:hover:bg-dark-hover"
                          title="Inspect signal evidence"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        <select
                          value={item.disavowStatus}
                          onChange={(e) =>
                            updateBacklinkDisavow(
                              item.id,
                              e.target.value as any,
                            )
                          }
                          className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
                        >
                          <option value="none">Unresolved</option>
                          <option value="disavow-link">Disavow Link</option>
                          <option value="disavow-domain">Disavow Domain</option>
                          <option value="whitelisted">Whitelist</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Signal Evidence Modal */}
      {inspectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="tool-panel relative w-full max-w-lg p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-gray-900 dark:text-white">
                  Signal Evidence Breakdown
                </h3>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-md mt-0.5">
                  {inspectedLink.url}
                </p>
              </div>
              <button
                onClick={() => setInspectedLink(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block">
                  Evaluated Score
                </span>
                <span className="text-lg font-bold font-heading text-gray-900 dark:text-white">
                  {inspectedLink.result.score}/100 (
                  {inspectedLink.result.category.toUpperCase()} RISK)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-xs text-right">
                {inspectedLink.result.explanation}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 block">
                Signals Checked
              </span>
              {inspectedLink.result.signals.map((s) => (
                <div
                  key={s.code}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    s.detected
                      ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                      : "bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <div>
                    <span className="font-semibold">{s.label}</span>
                    {s.evidence && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {s.evidence}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.detected
                        ? "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200"
                        : "bg-gray-100 dark:bg-dark-border text-gray-500"
                    }`}
                  >
                    {s.detected ? `+${s.points} pts` : "Low risk"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedLink(null)}
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
