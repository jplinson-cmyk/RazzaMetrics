import { IssueWorkspace } from "../common/IssueWorkspace";
import { IssueActions } from "../common/RecordActions";
import { display } from "../../services/measurements";
import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import { exportToCsv } from "../../utils/csvExport";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Check,
  Plus,
  MessageSquare,
} from "lucide-react";
import {
  IssueCategory,
  Severity,
  IssueStatus,
  SeoIssue,
} from "../../types/seo";
import { projectApi } from "../../services/api";

export const IssueTracker: React.FC = () => {
  const {
    issues,
    updateIssueStatus,
    currentProject,
    isAuditing,
    auditProgress,
    runFullSiteAudit,
    reload,
    queueJob,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">(
    "all",
  );
  const [selectedCategory, setSelectedCategory] = useState<
    IssueCategory | "all"
  >("all");
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus | "all">(
    "all",
  );
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(
    issues[0]?.id || null,
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<IssueCategory>("Crawlability");
  const [newSeverity, setNewSeverity] = useState<Severity>("warning");
  const [newImpact, setNewImpact] = useState<"High" | "Medium" | "Low">(
    "Medium",
  );
  const [newUrl, setNewUrl] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newHowToFix, setNewHowToFix] = useState("");

  // Live URL single check input
  const [testUrlInput, setTestUrlInput] = useState("");
  const [isUrlTesting, setIsUrlTesting] = useState(false);
  const [urlTestResult, setUrlTestResult] = useState<string | null>(null);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const noticeCount = issues.filter((i) => i.severity === "notice").length;
  const resolvedCount = issues.filter((i) => i.status === "resolved").length;

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      selectedSeverity === "all" || issue.severity === selectedSeverity;
    const matchesCategory =
      selectedCategory === "all" || issue.category === selectedCategory;
    const matchesStatus =
      selectedStatus === "all" || issue.status === selectedStatus;

    return matchesSearch && matchesSeverity && matchesCategory && matchesStatus;
  });

  const handleExportCsv = () => {
    const exportData = filteredIssues.map((i) => ({
      Platform: "Razza Metrics",
      Project: currentProject.name,
      Domain: currentProject.domain,
      ReportDate: new Date().toISOString(),
      DataRange:
        document
          .querySelector("[data-report-range]")
          ?.getAttribute("data-report-range") || "Stored measurements",
      DataSource: "Server HTML audit and persistent issues",
      Title: i.title,
      Category: i.category,
      Severity: i.severity.toUpperCase(),
      Status: i.status,
      Count: i.count,
      Impact: i.estimatedImpact,
      Explanation: i.explanation,
      AffectedUrls: i.affectedUrls.join(" | "),
    }));
    exportToCsv(`site-audit-issues-${currentProject.domain}`, exportData);
  };

  const handleRunUrlTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrlInput.trim()) return;
    setIsUrlTesting(true);
    setUrlTestResult(null);

    await queueJob("crawl", {
      url: testUrlInput.trim(),
      maxPages: 1,
      maxDepth: 0,
    });
    setIsUrlTesting(false);
    setUrlTestResult(
      "Crawl requested. View saved job status and actual findings below.",
    );
  };

  const handleSaveCustomIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newIssue: SeoIssue = {
      id: `issue-custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      severity: newSeverity,
      count: 1,
      affectedUrls: newUrl.trim()
        ? [newUrl.trim()]
        : [`https://${currentProject.domain}/`],
      explanation: newExplanation.trim() || "Custom SEO task created by user.",
      howToFix: newHowToFix.trim()
        ? [newHowToFix.trim()]
        : ["Review and apply fixes recommended for this issue category."],
      status: "to-do",
      estimatedImpact: newImpact,
    };

    try {
      await projectApi(currentProject.id, "issues", "POST", {
        projectId: currentProject.id,
        url: newUrl.trim() || `https://${currentProject.domain}/`,
        issueType: "custom_task",
        title: newIssue.title,
        description: newIssue.explanation,
        severity: newIssue.severity,
        status: "open",
        source: "manual",
        evidence: `Created manually for ${currentProject.domain}`,
        recommendation: newIssue.howToFix.join("; "),
        firstDetectedAt: new Date().toISOString(),
        lastDetectedAt: new Date().toISOString(),
        category: newCategory,
        count: 1,
        howToFix: newHowToFix.trim(),
        estimatedImpact: newImpact,
      });
      await reload();
    } catch (e) {
      window.alert((e as Error).message);
      return;
    }

    setNewTitle("");
    setNewUrl("");
    setNewExplanation("");
    setNewHowToFix("");
    setIsCreateModalOpen(false);
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Identify, prioritize, and resolve technical, content, and
            crawlability errors across {currentProject.domain}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95"
            title="Create a custom SEO task or issue"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
          <button
            onClick={runFullSiteAudit}
            disabled={isAuditing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 text-gray-800 dark:text-gray-200 text-xs font-semibold shadow-sm transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`}
            />
            <span>
              {isAuditing ? `Crawling (${auditProgress}%)` : "Run Fresh Crawl"}
            </span>
          </button>
          <ExportButton onClick={handleExportCsv} label="Export Issues CSV" />
        </div>
      </div>
      <IssueWorkspace />
      <IssueActions />

      {/* Severity Filter Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() =>
            setSelectedSeverity(selectedSeverity === "error" ? "all" : "error")
          }
          className={`p-4 rounded-xl border text-left transition-colors ${
            selectedSeverity === "error"
              ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 ring-2 ring-rose-500/20"
              : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Errors
            </span>
            <span className="text-xl font-bold font-heading text-rose-600 dark:text-rose-400">
              {errorCount}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Highest priority to fix
          </p>
        </button>

        <button
          onClick={() =>
            setSelectedSeverity(
              selectedSeverity === "warning" ? "all" : "warning",
            )
          }
          className={`p-4 rounded-xl border text-left transition-colors ${
            selectedSeverity === "warning"
              ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
              : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Warnings
            </span>
            <span className="text-xl font-bold font-heading text-amber-600 dark:text-amber-400">
              {warningCount}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Medium impact items</p>
        </button>

        <button
          onClick={() =>
            setSelectedSeverity(
              selectedSeverity === "notice" ? "all" : "notice",
            )
          }
          className={`p-4 rounded-xl border text-left transition-colors ${
            selectedSeverity === "notice"
              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
              : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              Notices
            </span>
            <span className="text-xl font-bold font-heading text-blue-600 dark:text-blue-400">
              {noticeCount}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Optimization tips</p>
        </button>

        <button
          onClick={() =>
            setSelectedStatus(
              selectedStatus === "resolved" ? "all" : "resolved",
            )
          }
          className={`p-4 rounded-xl border text-left transition-colors ${
            selectedStatus === "resolved"
              ? "border-razza-500 bg-razza-50/60 dark:bg-razza-950/30 ring-2 ring-razza-500/20"
              : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-razza-700 dark:text-razza-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Resolved
            </span>
            <span className="text-xl font-bold font-heading text-razza-600 dark:text-razza-400">
              {resolvedCount}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Fixed issues</p>
        </button>
      </div>

      {/* Live Single Page Audit Bar */}
      <div className="tool-panel p-4">
        <form
          onSubmit={handleRunUrlTest}
          className="flex flex-col sm:flex-row items-center gap-2"
        >
          <div className="relative flex-1 w-full">
            <input
              type="url"
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="Test a single URL (e.g. https://razzaconsulting.com/blog/new-post)"
              className="w-full pl-3.5 pr-4 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
            />
          </div>
          <button
            type="submit"
            disabled={isUrlTesting}
            className="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-dark-border hover:bg-gray-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-razza-400" />
            <span>{isUrlTesting ? "Analyzing..." : "Audit Single URL"}</span>
          </button>
        </form>

        {urlTestResult && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{urlTestResult}</span>
          </div>
        )}
      </div>

      {/* Filter & Search Controls */}
      <div className="tool-panel flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search issue title, category, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
          >
            <option value="all">All Categories</option>
            <option value="Crawlability">Crawlability</option>
            <option value="HTTPS & Security">HTTPS &amp; Security</option>
            <option value="Meta Tags & Content">Meta Tags &amp; Content</option>
            <option value="Links & Redirects">Links &amp; Redirects</option>
            <option value="Performance & Core Web Vitals">
              Core Web Vitals
            </option>
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
          >
            <option value="all">All Statuses</option>
            <option value="to-do">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Issues Accordion List */}
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="tool-panel p-8 text-center text-gray-500 text-xs">
            No issues match the selected filters. Great job!
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isExpanded = expandedIssueId === issue.id;

            const severityBadge =
              issue.severity === "error"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                : issue.severity === "warning"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40";

            const statusBadge =
              issue.status === "resolved"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : issue.status === "in-progress"
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400"
                  : "bg-gray-100 text-gray-700 dark:bg-dark-border dark:text-gray-300";

            return (
              <div
                key={issue.id}
                className={`bg-white dark:bg-dark-card border rounded-xl overflow-hidden transition-colors shadow-sm ${
                  isExpanded
                    ? "border-razza-500/60 ring-1 ring-razza-500/20"
                    : "border-gray-200 dark:border-dark-border hover:border-gray-300"
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() =>
                    setExpandedIssueId(isExpanded ? null : issue.id)
                  }
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-dark-hover/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {issue.severity === "error" && (
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      )}
                      {issue.severity === "warning" && (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                      {issue.severity === "notice" && (
                        <Info className="w-5 h-5 text-blue-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold font-heading text-gray-900 dark:text-white">
                          {issue.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge}`}
                        >
                          {issue.severity}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge}`}
                        >
                          {issue.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>
                          Category: <strong>{issue.category}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Affected:{" "}
                          <strong className="text-gray-900 dark:text-white">
                            {issue.count} pages
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Impact:{" "}
                          <strong className="text-razza-600 dark:text-razza-400">
                            {issue.estimatedImpact}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-surface/50 space-y-4 animate-fadeIn">
                    {/* Non-Technical Explanation */}
                    <div className="tool-panel p-3.5">
                      <h5 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-razza-500" />
                        <span>Why this matters for your rankings</span>
                      </h5>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        {issue.explanation}
                      </p>
                    </div>

                    {/* Step-by-Step Fix Guide */}
                    <div className="tool-panel p-3.5">
                      <h5 className="text-xs font-bold text-razza-600 dark:text-razza-400 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>How to Fix (Non-Technical Guide)</span>
                      </h5>
                      <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                        {issue.howToFix.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-razza-100 dark:bg-razza-900/50 text-razza-700 dark:text-razza-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-normal">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Affected URLs List */}
                    <div>
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Affected URLs ({issue.affectedUrls.length})
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {issue.affectedUrls.map((url, uIdx) => (
                          <div
                            key={uIdx}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs"
                          >
                            <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[80%]">
                              {url}
                            </span>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-razza-600 dark:text-razza-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>Inspect</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 mr-2">
                        Update Status:
                      </span>
                      <button
                        onClick={() => updateIssueStatus(issue.id, "to-do")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          issue.status === "to-do"
                            ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 font-bold"
                            : "bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        To Do
                      </button>
                      <button
                        onClick={() =>
                          updateIssueStatus(issue.id, "in-progress")
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          issue.status === "in-progress"
                            ? "bg-sky-600 text-white font-bold"
                            : "bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => updateIssueStatus(issue.id, "resolved")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          issue.status === "resolved"
                            ? "bg-razza-500 text-white font-bold"
                            : "bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        Mark as Resolved
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create New Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="tool-panel relative w-full max-w-lg p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-heading text-gray-900 dark:text-white">
                Create New SEO Issue / Task
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomIssue} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Issue Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implement JSON-LD Breadcrumb Schema"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200"
                  >
                    <option value="Crawlability">Crawlability</option>
                    <option value="HTTPS & Security">
                      HTTPS &amp; Security
                    </option>
                    <option value="Meta Tags & Content">Meta Tags</option>
                    <option value="Links & Redirects">Links</option>
                    <option value="Performance & Core Web Vitals">
                      Performance
                    </option>
                    <option value="Indexability">Indexability</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200"
                  >
                    <option value="error">Critical Error</option>
                    <option value="warning">Warning</option>
                    <option value="notice">Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Impact
                  </label>
                  <select
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value as any)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200"
                  >
                    <option value="High">High Impact</option>
                    <option value="Medium">Medium Impact</option>
                    <option value="Low">Low Impact</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target / Affected URL (optional)
                </label>
                <input
                  type="text"
                  placeholder={`https://${currentProject.domain}/path`}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Explanation &amp; Evidence
                </label>
                <textarea
                  rows={2}
                  placeholder="Why this issue matters and what was observed..."
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Recommended Fix
                </label>
                <input
                  type="text"
                  placeholder="Actionable steps to resolve..."
                  value={newHowToFix}
                  onChange={(e) => setNewHowToFix(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
