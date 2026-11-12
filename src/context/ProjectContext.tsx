import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ProjectDomain,
  SiteDataStore,
  ToxicMarkerDetail,
  IssueStatus,
} from "../types/seo";
import type {
  Backlink,
  SeoIssue as StoredIssue,
  TrackedKeyword as StoredKeyword,
  PageSpeedResult,
} from "../db/schema";
import { api, projectApi } from "../services/api";
import { aggregate, PerformanceRow, unpackRows } from "../services/measurements";
import { useAuth } from "./AuthContext";
interface ProjectRow {
  id: string;
  name: string;
  url: string;
  domain: string;
  gsc_property?: string;
  ga4_property?: string;
  code?: string;
  created_at: string;
  last_sync_at?: string;
  keywords_count?: number;
  referring_domains?: number;
  pages_crawled?: number | null;
}
interface Page {
  analysisStatus?: string;
  auditId?: string;
  url: string;
  statusCode: number;
  title?: string;
  findings: {
    checkType: string;
    severity: string;
    title: string;
    description: string;
    evidence?: string;
    recommendation: string;
  }[];
}
interface Job {
  id: string;
  type: string;
  status: string;
  progress: number;
  last_error?: string;
}
interface Snapshot {
  findings: {
    auditId: string;
    url: string;
    checkType: string;
    severity: string;
    title: string;
    description: string;
    evidence?: string;
    recommendation: string;
  }[];
  project: ProjectRow;
  keywords: StoredKeyword[];
  backlinks: Backlink[];
  issues: StoredIssue[];
  performance: PerformanceRow[];
  previousPerformance: PerformanceRow[];
  imports: {
    id: string;
    filename: string;
    rowCount: number;
    importedAt: string;
    rows?: Record<string, string>[];
  }[];
  pages: Page[];
  pagespeed: PageSpeedResult[];
  toxicity: {
    aggregateScore: number | null;
    calculatedAt: string;
    coveragePct: number;
    attributeCoveragePct: number;
  }[];
  audits: {
    id: string;
    status: string;
    pagesCrawled: number;
    completedAt?: string;
    scope?: { maxPages?: number };
  }[];
  jobs: Job[];
  truncated: boolean;
}
const empty: SiteDataStore = {
  issues: [],
  keywords: [],
  organicKeywords: [],
  backlinks: [],
  onPageChecks: [],
  weeklyReports: [],
};
function projectShape(p: ProjectRow): ProjectDomain {
  return {
    id: p.id,
    domain: p.domain,
    name: p.name,
    createdDate: p.created_at,
    gscProperty: p.gsc_property,
    ga4Property: p.ga4_property,
    code: p.code,
    lastSyncDate: p.last_sync_at,
    healthScore: NaN,
    totalPagesCrawled: p.pages_crawled ?? 0,
    organicTrafficMonthly: NaN,
    trackedKeywordsCount: p.keywords_count ?? 0,
    referringDomainsCount: p.referring_domains ?? 0,
    overallToxicityScore: NaN,
  };
}
function viewData(s: Snapshot): SiteDataStore {
  const grouped = new Map<string, PerformanceRow[]>();
  for (const row of s.performance) {
    const group = grouped.get(row.keyword) || [];
    group.push(row);
    grouped.set(row.keyword, group);
  }
  const allClicks = aggregate(s.performance).clicks;
  return {
    ...empty,
    keywords: s.keywords.map((k) => {
      const records = s.performance.filter(
        (r) => r.keyword.toLowerCase() === k.keyword.toLowerCase(),
      );
      const a = aggregate(records);
      const dates = [...new Set(records.map((r) => r.date))].sort();
      return {
        id: k.id,
        keyword: k.keyword,
        currentRank: a.position,
        previousRank: aggregate(
          s.previousPerformance.filter(
            (r) => r.keyword.toLowerCase() === k.keyword.toLowerCase(),
          ),
        ).position,
        change:
          aggregate(
            s.previousPerformance.filter(
              (r) => r.keyword.toLowerCase() === k.keyword.toLowerCase(),
            ),
          ).position - a.position,
        searchVolume: NaN,
        difficulty: NaN,
        cpc: NaN,
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.ctr,
        url: k.targetUrl || records[0]?.page || "",
        history: dates
          .map(
            (date) =>
              aggregate(records.filter((r) => r.date === date)).position,
          )
          .filter(Number.isFinite),
        historyDates: dates,
        serpFeatures: [],
        device: k.device,
        location: k.location,
        tags: Array.isArray(k.tags) ? k.tags : JSON.parse(k.tags || "[]"),
      };
    }),
    organicKeywords: [...grouped].map(([keyword, records]) => {
      const a = aggregate(records);
      return {
        id: keyword,
        keyword,
        intent: "Unknown",
        position: a.position,
        previousPosition: aggregate(
          s.previousPerformance.filter((r) => r.keyword === keyword),
        ).position,
        trafficEstimate: a.clicks,
        trafficPercentage: allClicks ? (a.clicks / allClicks) * 100 : 0,
        volume: a.impressions,
        kd: NaN,
        cpc: NaN,
        url: records[0]?.page || "",
        serpFeatures: [],
      };
    }),
    backlinks: s.backlinks.map((b) => ({
      id: b.id,
      sourceDomain: b.sourceDomain,
      sourceTitle: b.sourceDomain,
      sourceUrl: b.sourceUrl || "",
      targetUrl: b.targetUrl || "",
      anchorText: b.anchorText || "",
      authorityScore: b.openPagerank === undefined ? NaN : b.openPagerank,
      linkType: (b.linkType || "unknown") as "dofollow" | "unknown",
      firstSeen: b.firstSeen || "",
      lastSeen: b.lastSeen || "",
      toxicityScore: b.riskCategory === "unknown" ? NaN : b.riskScore,
      toxicMarkers: JSON.parse(b.riskSignals || "[]")
        .filter((r: { detected?: boolean }) => r.detected)
        .map((r: { label: string }) => r.label),
      disavowStatus: b.disavowStatus,
    })),
    issues: s.issues.map((i) => ({
      id: i.id,
      title: i.title,
      category: (i.category || "Crawlability") as "Crawlability",
      severity: i.severity,
      count: 1,
      affectedUrls: i.url ? [i.url] : [],
      explanation: i.description,
      howToFix: [i.recommendation || "Review the evidence."],
      status: i.status === "open" ? "to-do" : i.status,
      estimatedImpact: i.severity === "error" ? "High" : "Medium",
    })),
    onPageChecks: (s.pages[0]?.findings || []).map((f) => ({
      id: f.checkType,
      category: "Technical",
      title: f.title,
      description: f.description,
      currentValue: f.evidence || f.description,
      recommendedValue: f.recommendation,
      status: f.severity === "error" ? "failed" : "warning",
      priority: f.severity === "error" ? "High" : "Medium",
      checked: s.issues.some(
        (i) =>
          i.issueType === f.checkType &&
          i.url === s.pages[0]?.url &&
          i.status === "resolved",
      ),
    })),
  };
}
interface ContextType extends SiteDataStore {
  projects: ProjectDomain[];
  currentProject: ProjectDomain;
  loading: boolean;
  /** A filter change is loading new figures while the previous ones stay visible. */
  refreshing: boolean;
  error: string | null;
  snapshot: Snapshot | null;
  setCurrentProjectById: (id: string) => Promise<void>;
  addNewProject: (domain: string, code?: string) => Promise<void>;
  /** Link the matching Search Console and GA4 properties from the connected Google account. */
  linkGoogle: () => Promise<{ gscProperty?: string; ga4Property?: string }>;
  batchAddProjects: (
    text: string,
  ) => Promise<{ added: number; skipped: number }>;
  deleteProject: (id: string) => Promise<boolean>;
  updateProject: (data: {
    name?: string;
    gscProperty?: string;
    ga4Property?: string;
    code?: string;
  }) => Promise<void>;
  reloadBacklinks: () => Promise<void>;
  reload: () => Promise<void>;
  updateIssueStatus: (id: string, status: IssueStatus) => void;
  isAuditing: boolean;
  auditProgress: number;
  auditStepText: string;
  runFullSiteAudit: () => Promise<void>;
  addTrackedKeyword: (
    keyword: string,
    location?: string,
    tags?: string[],
  ) => void;
  deleteTrackedKeyword: (id: string) => void;
  updateBacklinkDisavow: (
    id: string,
    status: "none" | "disavow-link" | "disavow-domain" | "whitelisted",
  ) => void;
  toxicMarkers: ToxicMarkerDetail[];
  toggleOnPageCheck: (id: string) => void;
  runOnPageAudit: (url: string, keyword: string) => Promise<void>;
  isOnPageAuditing: boolean;
  dispatchWeeklyReport: (recipients: string[]) => void;
  queueJob: (type: string, payload?: Record<string, unknown>) => Promise<void>;
  filters: { start: string; end: string; device: string; country: string };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      start: string;
      end: string;
      device: string;
      country: string;
    }>
  >;
}
const Context = createContext<ContextType | undefined>(undefined);
export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectDomain[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const snapshotRef = useRef<Snapshot | null>(null);
  snapshotRef.current = snapshot;
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    start: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
    device: "",
    country: "",
  });
  const generation = useRef(0);
  const currentRef = useRef(currentId);
  currentRef.current = currentId;
  useEffect(() => {
    generation.current++;
    setSnapshot(null);
    setProjects([]);
    setCurrentId("");
    let alive = true;
    if (user)
      api<ProjectRow[]>("/projects")
        .then((p) => {
          if (alive) {
            setProjects(p.map(projectShape));
            setCurrentId(p[0]?.id || "");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const reload = useCallback(async () => {
    if (!user || !currentId) return;
    const gen = ++generation.current;
    try {
      const result = await projectApi<Snapshot>(
        currentId,
        "data?" + new URLSearchParams(filters),
      );
      if (gen !== generation.current || currentId !== currentRef.current)
        return;
      result.performance = unpackRows(result.performance);
      result.previousPerformance = unpackRows(result.previousPerformance);
      setSnapshot(result);
      setError(
        result.truncated
          ? "Display capped at 10,000 measurements. Narrow the date range or filters."
          : null,
      );
      // Latest completed full site crawl; single-URL on-page checks (maxPages 1) must not stand in for site health.
      const audit = result.audits.find(
        (a) => a.status === "completed" && (a.scope?.maxPages ?? 2) > 1,
      );
      setProjects((old) =>
        old.map((p) =>
          p.id === currentId
            ? {
                ...projectShape(result.project),
                lastAuditDate: audit?.completedAt,
                healthScore: (() => {
                  const pages = result.pages.filter(
                    (page) => page.auditId === audit?.id && (!page.analysisStatus || page.analysisStatus==='complete'),
                  );
                  return pages.length
                    ? Math.round(
                        (100 *
                          pages.filter(
                            (page) =>
                              !page.findings.some(
                                (f) => f.severity === "error",
                              ),
                          ).length) /
                          pages.length,
                      )
                    : NaN;
                })(),
                trackedKeywordsCount: result.keywords.length,
                totalPagesCrawled: audit?.pagesCrawled || 0,
                organicTrafficMonthly: result.performance.length
                  ? aggregate(result.performance).clicks
                  : NaN,
                referringDomainsCount: new Set(
                  result.backlinks.map((b) => b.sourceDomain),
                ).size,
                overallToxicityScore: result.toxicity[0]?.aggregateScore ?? NaN,
              }
            : p,
        ),
      );
    } catch (e) {
      if (gen === generation.current) {
        setSnapshot(null);
        setError(e instanceof Error ? e.message : "Load failed.");
      }
    } finally {
      if (gen === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id, currentId, filters]);
  useEffect(() => {
    // A filter change keeps the current project's figures on screen (dimmed) while the new ones load.
    const same = snapshotRef.current?.project.id === currentId;
    if (same) setRefreshing(true);
    else {
      setSnapshot(null);
      setLoading(!!currentId);
    }
    void reload();
  }, [reload]);
  const active =
    snapshot?.jobs.filter((j) => ["QUEUED", "RUNNING"].includes(j.status)) ||
    [];
  useEffect(() => {
    if (!active.length || !currentId) return;
    // One "process jobs" call at a time: each call now works for up to ~25 s, so overlapping calls only waste quota.
    let processing = false;
    // Reload the page data only after a round of work finishes: reloading every tick re-sent every stored record each time.
    const timer = window.setInterval(() => {
      if (processing) return;
      processing = true;
      void projectApi(currentId, "jobs/process", "POST")
        .catch((e) => setError(e.message))
        .finally(() => {
          processing = false;
          void reload();
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [currentId, active.length, reload]);
  const safely = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    }
  };
  const addNewProject = async (domain: string, code?: string) =>
    safely(async () => {
      const p = await api<ProjectRow>("/projects", "POST", {
        url: domain,
        ...(code ? { code } : {}),
      });
      setProjects((old) => [projectShape(p), ...old]);
      generation.current++;
      currentRef.current = p.id;
      setSnapshot(null);
      setCurrentId(p.id);
    });
  const queueJob = async (
    type: string,
    payload: Record<string, unknown> = {},
  ) =>
    safely(() => projectApi(currentId, "jobs", "POST", { type, ...payload }));
  const siteData = snapshot ? viewData(snapshot) : empty;
  const auditing = active.find((j) => j.type === "crawl");
  return (
    <Context.Provider
      value={{
        ...siteData,
        projects,
        currentProject:
          projects.find((p) => p.id === currentId) ||
          projectShape({
            id: "",
            name: "Add your first project",
            domain: "",
            url: "",
            created_at: "",
          }),
        loading,
        refreshing,
        error,
        snapshot,
        filters,
        setFilters,
        setCurrentProjectById: async (id) => {
          generation.current++;
          currentRef.current = id;
          setSnapshot(null);
          setCurrentId(id);
        },
        addNewProject,
        linkGoogle: async () => {
          const r = await projectApi<{ linked: { gscProperty?: string; ga4Property?: string } }>(currentId, "google/link", "POST");
          await reload();
          return r.linked;
        },
        batchAddProjects: async (text) => {
          let added = 0;
          let skipped = 0;
          for (const domain of [
            ...new Set(text.split(/[\s,;]+/).filter(Boolean)),
          ]) {
            if (projects.some((p) => p.domain === domain)) {
              skipped++;
              continue;
            }
            await addNewProject(domain);
            added++;
          }
          return { added, skipped };
        },
        deleteProject: async (id) => {
          let success = false;
          await safely(async () => {
            await api(`/projects/${id}`, "DELETE");
            setProjects((old) => old.filter((p) => p.id !== id));
            if (id === currentId) {
              setSnapshot(null);
              setCurrentId(projects.find((p) => p.id !== id)?.id || "");
            }
            success = true;
          });
          return success;
        },
        updateProject: (data) =>
          safely(() => api(`/projects/${currentId}`, "PATCH", data)),
        reload,
        reloadBacklinks: reload,
        queueJob,
        updateIssueStatus: (id, status) => {
          void safely(() =>
            projectApi(currentId, `issues/${id}`, "PATCH", {
              status: status === "to-do" ? "open" : status,
            }),
          );
        },
        isAuditing: !!auditing,
        isOnPageAuditing: !!auditing,
        auditProgress: auditing?.progress || 0,
        auditStepText:
          auditing?.last_error ||
          (auditing ? "Crawl queued or running; progress is saved." : ""),
        runFullSiteAudit: () =>
          queueJob("crawl", { maxPages: 25, maxDepth: 3 }),
        addTrackedKeyword: (keyword, location = "All countries", tags = []) => {
          void safely(() =>
            projectApi(currentId, "keywords", "POST", {
              keyword,
              location,
              tags,
            }),
          );
        },
        deleteTrackedKeyword: (id) => {
          void safely(() => projectApi(currentId, `keywords/${id}`, "DELETE"));
        },
        updateBacklinkDisavow: (id, disavowStatus) => {
          void safely(() =>
            projectApi(currentId, `backlinks/${id}`, "PATCH", {
              disavowStatus,
            }),
          );
        },
        toxicMarkers: [],
        toggleOnPageCheck: (id) => {
          const issue = snapshot?.issues.find(
            (i) => i.issueType === id && i.url === snapshot.pages[0]?.url,
          );
          if (issue)
            void safely(() =>
              projectApi(currentId, `issues/${issue.id}`, "PATCH", {
                status: issue.status === "resolved" ? "open" : "resolved",
              }),
            );
        },
        runOnPageAudit: (url) =>
          queueJob("crawl", { url, maxPages: 1, maxDepth: 0 }),
        dispatchWeeklyReport: () =>
          setError(
            "Email delivery is not configured. Export measured results as CSV.",
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
};
export function useProject() {
  const value = useContext(Context);
  if (!value) throw new Error("ProjectProvider missing.");
  return value;
}
