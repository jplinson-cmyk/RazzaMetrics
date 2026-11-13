import { display } from "../../services/measurements";
import { AuditCharts } from "../explorer/AuditCharts";
import { AuditHistory } from "../common/AuditHistory";
import { ToolInsights } from "../common/ToolInsights";
import React, { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { ExportButton } from "../common/ExportButton";
import { exportToCsv } from "../../utils/csvExport";
import {
  FileCheck2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Zap,
  Tag,
} from "lucide-react";
import { OnPageCheckResult } from "../../types/seo";
import {
  runPageSpeedTest,
  PageSpeedApiResult,
} from "../../services/pageSpeedApi";
import { PageAnalysis } from "../../services/crawler";
import { Gauge, Cpu, Activity, Clock } from "lucide-react";

export const OnPageChecker: React.FC = () => {
  const {
    onPageChecks,
    toggleOnPageCheck,
    runOnPageAudit,
    queueJob,
    isOnPageAuditing,
    currentProject,
    snapshot,
    reload,
  } = useProject();

  const [inputUrl, setInputUrl] = useState(`https://${currentProject.domain}/`);
  const [inputKeyword, setInputKeyword] = useState("");
  const [fullSite, setFullSite] = useState(false);
  const [maxPages, setMaxPages] = useState(25);
  const [maxDepth, setMaxDepth] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isPsiRunning, setIsPsiRunning] = useState(false);
  // Set while a queued test is running; cleared when a result newer than the request arrives.
  const [psiRequestedAt, setPsiRequestedAt] = useState("");
  const [psiResult, setPsiResult] = useState<PageSpeedApiResult | null>(null);
  const [psiStrategy, setPsiStrategy] = useState<"mobile" | "desktop">(
    "mobile",
  );
  const [crawlData, setCrawlData] = useState<PageAnalysis | null>(null);

  const totalChecks = onPageChecks.length;
  const passedChecks = onPageChecks.filter((c) => c.status === "passed").length;
  const optimizationScore = currentProject.healthScore;
  useEffect(() => {
    setInputUrl(`https://${currentProject.domain}/`);
    setCrawlData(null);
    setPsiResult(null);
  }, [currentProject.id]);
  useEffect(() => {
    const page = snapshot?.pages.find((p) => p.url === inputUrl);
    if (page) setCrawlData(page as PageAnalysis);
    const mobile = snapshot?.pagespeed.find(
      (p) => p.url === inputUrl && p.strategy === "mobile",
    );
    const desktop = snapshot?.pagespeed.find(
      (p) => p.url === inputUrl && p.strategy === "desktop",
    );
    if (mobile || desktop) setPsiResult({ mobile, desktop });
    if (psiRequestedAt && [mobile, desktop].every((r) => r && r.testedAt >= psiRequestedAt)) setPsiRequestedAt("");
    // A test that gave up shows Google's reason instead of "running" forever.
    const failed = psiRequestedAt && snapshot?.jobs.find((j) => j.type === "pagespeed" && j.status === "FAILED" && (j.created_at || "") >= psiRequestedAt);
    if (failed) {
      setPsiResult((r) => ({ ...r, error: failed.last_error || "PageSpeed Insights could not test this URL." }));
      setPsiRequestedAt("");
    }
  }, [snapshot, inputUrl, psiRequestedAt]);

  const filteredChecks = onPageChecks.filter((c) => {
    if (selectedCategory === "all") return true;
    return c.category === selectedCategory;
  });

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    await queueJob("crawl", {
      url: inputUrl.trim(),
      maxPages: fullSite ? maxPages : 1,
      maxDepth: fullSite ? maxDepth : 0,
    });
  };

  const handleRunPageSpeed = async () => {
    if (!inputUrl.trim()) return;
    setIsPsiRunning(true);
    try {
      // A minute of slack: the browser and server clocks can differ by a few seconds.
      setPsiRequestedAt(new Date(Date.now() - 60000).toISOString());
      setPsiResult((r) => r ?? {});
      await runPageSpeedTest(currentProject.id, inputUrl.trim());
      await reload();
    } catch (e) {
      setPsiResult({
        error: e instanceof Error ? e.message : "PageSpeed failed.",
      });
    } finally {
      setIsPsiRunning(false);
    }
  };

  const handleExportCsv = () => {
    const exportData = onPageChecks.map((c) => ({
      Platform: "Razza Metrics",
      Project: currentProject.name,
      Domain: currentProject.domain,
      ReportDate: new Date().toISOString(),
      DataRange:
        document
          .querySelector("[data-report-range]")
          ?.getAttribute("data-report-range") || "Stored measurements",
      DataSource: "Server HTML audit and persistent issues",
      Category: c.category,
      Title: c.title,
      Priority: c.priority,
      Status: c.status.toUpperCase(),
      Completed: c.checked ? "YES" : "NO",
      CurrentValue: c.currentValue,
      RecommendedAction: c.recommendedValue,
      Description: c.description,
    }));
    exportToCsv(`onpage-seo-audit-${currentProject.domain}`, exportData);
  };

  const getStatusIcon = (status: OnPageCheckResult["status"]) => {
    switch (status) {
      case "passed":
        return (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        );
      case "warning":
        return (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        );
      case "failed":
        return <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <div>
          <p className="tool-intro">
            Inspect actual HTML, technical findings, and Google PageSpeed
            measurements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            onClick={handleExportCsv}
            label="Export Audit Checklist"
          />
        </div>
      </div>

      <AuditCharts />
      <ToolInsights tool="onpage" />
      <AuditHistory />

      {/* Input Analyzer Bar */}
      <div className="tool-panel p-4">
        <form onSubmit={handleRunAudit} className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <label>
              <input
                type="checkbox"
                checked={fullSite}
                onChange={(e) => setFullSite(e.target.checked)}
              />{" "}
              Full site scan
            </label>
            {fullSite && (
              <>
                <label>
                  Maximum pages{" "}
                  <input
                    aria-label="Maximum crawl pages"
                    className="w-16 p-1 rounded border dark:bg-dark-surface"
                    type="number"
                    min={1}
                    max={25}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                  />
                </label>
                <label>
                  Maximum depth{" "}
                  <input
                    aria-label="Maximum crawl depth"
                    className="w-16 p-1 rounded border dark:bg-dark-surface"
                    type="number"
                    min={0}
                    max={3}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </div>
          <div className="text-xs font-bold text-gray-400 dark:text-gray-500">
            Target Page &amp; Primary Keyword Analysis
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-7">
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Target Page URL
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://example.com/page-to-optimize"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500 font-mono"
                required
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Target Focus Keyword
              </label>
              <input
                type="text"
                value={inputKeyword}
                onChange={(e) => setInputKeyword(e.target.value)}
                placeholder="e.g. enterprise seo consulting"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
              />
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <button
                type="submit"
                disabled={isOnPageAuditing}
                className="flex-1 py-2 px-3 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isOnPageAuditing ? (
                  <>
                    <span className="inline-block animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRunPageSpeed}
                disabled={isPsiRunning}
                className="btn-secondary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Run Google PageSpeed Insights & Core Web Vitals"
              >
                {isPsiRunning ? (
                  <>
                    <span className="inline-block animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>PageSpeed</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Real Crawl Overview if available */}
        {crawlData && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                HTTP Status
              </span>
              <span
                className={`font-bold font-mono ${crawlData.statusCode === 200 ? "text-emerald-600" : "text-amber-600"}`}
              >
                {crawlData.statusCode || "CORS / Direct"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                Word Count
              </span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {crawlData.wordCount} words
              </span>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                H1 Tags
              </span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {crawlData.h1Tags.length} detected
              </span>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                Missing Alt
              </span>
              <span
                className={`font-bold ${crawlData.images.filter((i) => !i.hasAlt).length > 0 ? "text-rose-600" : "text-emerald-600"}`}
              >
                {crawlData.images.filter((i) => !i.hasAlt).length} images
              </span>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                Robots.txt
              </span>
              <span
                className={`font-bold ${crawlData.hasRobots ? "text-emerald-600" : "text-amber-600"}`}
              >
                {crawlData.hasRobots ? "Detected" : "Not found"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-surface">
              <span className="text-[10px] text-gray-400 block font-bold">
                XML Sitemap
              </span>
              <span
                className={`font-bold ${crawlData.hasSitemap ? "text-emerald-600" : "text-amber-600"}`}
              >
                {crawlData.hasSitemap ? "Linked" : "Not referenced"}
              </span>
            </div>
          </div>
        )}

        {/* Real Google PageSpeed Insights & Core Web Vitals Panel */}
        {psiResult && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold font-heading text-gray-900 dark:text-white">
                  Google PageSpeed Insights &amp; Core Web Vitals
                </h4>
                {psiRequestedAt && psiResult[psiStrategy] && (
                  <span className="text-[10px] text-gray-500" role="status">Updating… showing the last test</span>
                )}
              </div>

              <div className="flex rounded-lg bg-gray-100 dark:bg-dark-surface p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPsiStrategy("mobile")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    psiStrategy === "mobile"
                      ? "bg-white dark:bg-dark-card text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setPsiStrategy("desktop")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    psiStrategy === "desktop"
                      ? "bg-white dark:bg-dark-card text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Desktop
                </button>
              </div>
            </div>

            {psiResult[psiStrategy] ? (
              <div className="space-y-3">
                {/* 4 Lighthouse category scores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border text-center">
                    <span className="text-[10px] font-bold text-gray-400 block">
                      Performance
                    </span>
                    <span className="text-xl font-bold font-heading text-emerald-600 mt-0.5 block">
                      {display(psiResult[psiStrategy]!.performance)}/100
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border text-center">
                    <span className="text-[10px] font-bold text-gray-400 block">
                      Accessibility
                    </span>
                    <span className="text-xl font-bold font-heading text-emerald-600 mt-0.5 block">
                      {display(psiResult[psiStrategy]!.accessibility)}/100
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border text-center">
                    <span className="text-[10px] font-bold text-gray-400 block">
                      Best Practices
                    </span>
                    <span className="text-xl font-bold font-heading text-emerald-600 mt-0.5 block">
                      {display(psiResult[psiStrategy]!.bestPractices)}/100
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border text-center">
                    <span className="text-[10px] font-bold text-gray-400 block">
                      SEO Score
                    </span>
                    <span className="text-xl font-bold font-heading text-razza-600 mt-0.5 block">
                      {display(psiResult[psiStrategy]!.seoScore)}/100
                    </span>
                  </div>
                </div>

                {/* Core Web Vitals (CrUX field vs lab metrics) */}
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      Core Web Vitals ({psiStrategy.toUpperCase()})
                    </span>
                    <span className="text-[10px] text-gray-400">
                      CrUX field measurements (when available)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        LCP (Largest Paint)
                      </span>
                      <span className="font-bold font-mono text-xs text-gray-900 dark:text-white mt-0.5 block">
                        {psiResult[psiStrategy]!.lcp !== undefined
                          ? `${psiResult[psiStrategy]!.lcp}s`
                          : "Not Available"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        CLS (Layout Shift)
                      </span>
                      <span className="font-bold font-mono text-xs text-gray-900 dark:text-white mt-0.5 block">
                        {psiResult[psiStrategy]!.cls !== undefined
                          ? psiResult[psiStrategy]!.cls
                          : "Not Available"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        INP (Interaction)
                      </span>
                      <span className="font-bold font-mono text-xs text-gray-900 dark:text-white mt-0.5 block">
                        {psiResult[psiStrategy]!.inp !== undefined
                          ? `${psiResult[psiStrategy]!.inp}s`
                          : "Not Available"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        FCP (First Paint)
                      </span>
                      <span className="font-bold font-mono text-xs text-gray-900 dark:text-white mt-0.5 block">
                        {psiResult[psiStrategy]!.fcp !== undefined
                          ? `${psiResult[psiStrategy]!.fcp}s`
                          : "Not Available"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-blue-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        TTFB (Server Time)
                      </span>
                      <span className="font-bold font-mono text-xs text-gray-900 dark:text-white mt-0.5 block">
                        {psiResult[psiStrategy]!.ttfb !== undefined
                          ? `${psiResult[psiStrategy]!.ttfb}s`
                          : "Not Available"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-600 dark:text-rose-400 p-2">
                {psiResult.error ||
                  (psiRequestedAt
                    ? "Running PageSpeed Insights… a test takes 20–60 seconds; results appear here when it finishes."
                    : `No ${psiStrategy} PageSpeed result for this URL yet. Run a test above.`)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optimization Score & Breakdown Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="tool-panel p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-razza-50 dark:bg-razza-900/30 text-razza-600 dark:text-razza-400 flex items-center justify-center font-heading font-black text-2xl flex-shrink-0">
            {display(optimizationScore)}%
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400">
              Pages without critical findings
            </div>
            <div className="font-heading font-bold text-sm text-gray-900 dark:text-white mt-0.5">
              {currentProject.totalPagesCrawled} pages in the latest completed
              crawl
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Based on observed HTML findings only
            </div>
          </div>
        </div>

        <div className="tool-panel p-4">
          <div className="text-xs font-bold text-gray-400">
            Priority Tasks
          </div>
          <div className="text-xl font-bold font-heading text-rose-600 dark:text-rose-400 mt-1">
            {
              onPageChecks.filter(
                (c) =>
                  c.status === "failed" ||
                  (c.status === "warning" && !c.checked),
              ).length
            }{" "}
            Action Items
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            High impact on organic click-through rate
          </p>
        </div>

        <div className="tool-panel p-4">
          <div className="text-xs font-bold text-gray-400">
            Completed Fixes
          </div>
          <div className="text-xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
            {onPageChecks.filter((c) => c.checked).length} Completed
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Check tasks as you implement them
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-dark-border pb-2 text-xs font-semibold">
        {[
          "all",
          "Strategy",
          "Content",
          "Technical",
          "UX & Performance",
          "Backlinks",
        ].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedCategory === cat
                ? "bg-razza-500 text-white shadow-sm"
                : "bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border"
            }`}
          >
            {cat === "all" ? "All Recommendations" : cat}
          </button>
        ))}
      </div>

      {/* Actionable Recommendations Checklist */}
      <div className="space-y-3">
        {filteredChecks.map((check) => (
          <div
            key={check.id}
            className={`p-4 rounded-xl border transition-colors ${
              check.checked
                ? "bg-gray-50/70 dark:bg-dark-surface/40 border-gray-200 dark:border-dark-border opacity-70"
                : "bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border shadow-sm hover:border-razza-500/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {/* Interactive Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleOnPageCheck(check.id)}
                  className="mt-0.5 text-gray-400 hover:text-razza-600 dark:hover:text-razza-400 transition-colors"
                  title="Toggle task completion"
                >
                  {check.checked ? (
                    <CheckSquare className="w-5 h-5 text-razza-600 dark:text-razza-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusIcon(check.status)}
                    <h4
                      className={`text-xs sm:text-sm font-bold font-heading ${
                        check.checked
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {check.title}
                    </h4>

                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-400 font-medium">
                      {check.category}
                    </span>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        check.priority === "High"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {check.priority} Priority
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {check.description}
                  </p>

                  {/* Benchmark & Action comparison box */}
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
                      <span className="text-[10px] font-bold text-gray-400 block">
                        Detected Current Value:
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium mt-0.5 block truncate">
                        {check.currentValue}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-razza-50/60 dark:bg-razza-950/20 border border-razza-200 dark:border-razza-800/40">
                      <span className="text-[10px] font-bold text-razza-600 dark:text-razza-400 block">
                        Recommended Fix:
                      </span>
                      <span className="text-razza-900 dark:text-razza-200 font-semibold mt-0.5 block">
                        {check.recommendedValue}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status pill */}
              <div className="flex-shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    check.status === "passed"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : check.status === "warning"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  {check.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
