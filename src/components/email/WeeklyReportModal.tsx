import React from "react";
import { X, Download } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { exportToCsv } from "../../utils/csvExport";
import { aggregate, display } from "../../services/measurements";
export const WeeklyReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { currentProject, snapshot, filters } = useProject();
  if (!isOpen) return null;
  const measured = aggregate(snapshot?.performance || []);
  const report = {
    Platform: "Razza Metrics",
    Project: currentProject.name,
    Domain: currentProject.domain,
    ReportDate: new Date().toISOString(),
    DataFrom: filters.start,
    DataTo: filters.end,
    Source: "Search Console; imported backlinks; server HTML audits",
    Clicks: snapshot?.performance.length ? measured.clicks : "Not Available",
    Impressions: snapshot?.performance.length
      ? measured.impressions
      : "Not Available",
    AveragePosition: display(measured.position),
    TrackedKeywords: snapshot?.keywords.length || 0,
    ImportedBacklinks: snapshot?.backlinks.length || 0,
    OpenIssues:
      snapshot?.issues.filter((i) => i.status !== "resolved").length || 0,
    Limitations:
      "GSC top queries only; imported links are unverified; toxicity is a Razza heuristic; static HTML audit.",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-dark-card rounded-2xl border dark:border-dark-border shadow-2xl p-6 space-y-5">
        <div className="flex justify-between">
          <h2 className="font-heading font-bold dark:text-white">
            Razza Metrics — Project Report
          </h2>
          <button aria-label="Close report" onClick={onClose}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          {Object.entries(report).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="dark:text-white break-words">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <button
          disabled={!currentProject.id}
          className="px-4 py-2 rounded-xl bg-razza-500 text-white text-xs flex gap-2"
          onClick={() => exportToCsv("razza-project-report", [report])}
        >
          <Download className="w-4 h-4" />
          Export measured report
        </button>
        <p className="text-xs text-gray-500">
          Email delivery is unavailable. Download the report to share it.
        </p>
      </div>
    </div>
  );
};
