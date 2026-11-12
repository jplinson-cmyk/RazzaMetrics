import React from "react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import { ProjectRules } from "./ProjectRules";
export const ProjectStatus: React.FC<{ onAddProject: () => void }> = ({
  onAddProject,
}) => {
  const {
    currentProject,
    loading,
    error,
    snapshot,
    filters,
    setFilters,
    reload,
    queueJob,
    updateProject,
  } = useProject();
  const input =
    "p-2 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-xs dark:text-white";
  return (
    <div
      className="space-y-3 mb-6"
      data-report-range={`${filters.start} to ${filters.end}`}
    >
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm"
        >
          {error}
          <button className="ml-3 underline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      )}
      {loading && (
        <div role="status" className="p-4 text-sm text-gray-500">
          Loading saved project measurements…
          <div
            aria-hidden="true"
            className="grid grid-cols-3 gap-3 mt-4 animate-pulse"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700"
              />
            ))}
          </div>
        </div>
      )}
      {!currentProject.id ? (
        <div className="tool-panel p-4">
          <p className="text-sm dark:text-white">
            Add a website to begin. Connect Search Console, import backlinks, or
            run a crawl to collect real measurements.
          </p>
          <button
            className="mt-4 px-4 py-2 rounded-xl bg-razza-500 text-white"
            onClick={onAddProject}
          >
            Add project
          </button>
        </div>
      ) : (
        <>
          {(!currentProject.gscProperty ||
            !snapshot?.audits.some((a) => a.status === "completed")) && (
            <details className="analytics-panel" open={!snapshot?.jobs.length}>
              <summary className="font-semibold text-sm">
                Welcome — finish setting up your website
              </summary>
              <ol className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
                <li>✓ Website project created</li>
                <li>
                  {currentProject.gscProperty ? "✓" : "○"} Select Google
                  property using GSC in the header
                </li>
                <li>
                  {snapshot?.audits.some((a) => a.status === "completed")
                    ? "✓"
                    : "○"}{" "}
                  Run your first technical audit{" "}
                  <button
                    className="text-blue-600 underline"
                    onClick={() =>
                      void queueJob("crawl", { maxPages: 1, maxDepth: 0 })
                    }
                  >
                    Run audit
                  </button>
                </li>
              </ol>
              <p className="text-xs text-slate-500 mt-3">
                Google is optional for imports, issue management and technical
                audits. Setup progress reflects saved project records.
              </p>
            </details>
          )}
          <div className="tool-panel flex flex-wrap items-end gap-2 p-4">
            <label className="text-xs text-gray-500">
              From{" "}
              <input
                aria-label="Start date"
                type="date"
                className={input}
                value={filters.start}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, start: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-gray-500">
              To{" "}
              <input
                aria-label="End date"
                type="date"
                className={input}
                value={filters.end}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, end: e.target.value }))
                }
              />
            </label>
            <select
              aria-label="Device filter"
              className={input}
              value={filters.device}
              onChange={(e) =>
                setFilters((f) => ({ ...f, device: e.target.value }))
              }
            >
              <option value="">All devices</option>
              {["DESKTOP", "MOBILE", "TABLET"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <input
              aria-label="Country code filter"
              className={input}
              placeholder="Country code (e.g. phl)"
              maxLength={3}
              value={filters.country}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  country: e.target.value.toLowerCase(),
                }))
              }
            />
            <button className={input} onClick={() => void reload()}>
              Refresh
            </button>
            <button
              className={input}
              disabled={!currentProject.gscProperty}
              onClick={() => void queueJob("gsc")}
            >
              Sync now
            </button>
            <button
              className={input}
              onClick={() => {
                const name = window.prompt("Project name", currentProject.name);
                if (name?.trim()) void updateProject({ name });
              }}
            >
              Edit project
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Search Console average position; imported backlinks; server HTML
            audits. Last successful sync:{" "}
            {currentProject.lastSyncDate || "Not yet synchronized"}. Authority
            enrichment: disabled.
          </p>
          <ProjectRules />
          {!snapshot?.performance.length && (
            <p className="text-xs text-gray-500">
              No Search Console measurements in this period. Connect a verified
              property using GSC, then sync. Google may take several days to
              finalize measurements.
            </p>
          )}
          {!!snapshot?.jobs.length && (
            <details
              className="p-3 rounded-xl bg-white dark:bg-dark-card border dark:border-dark-border text-xs text-gray-600 dark:text-gray-300"
              open={snapshot.jobs.some((j) => j.last_error)}
            >
              <summary>Saved background jobs ({snapshot.jobs.length})</summary>
              <ul className="space-y-2 mt-3">
                {snapshot.jobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap gap-2">
                    <span>
                      {j.type}: {j.status} ({j.progress}%)
                    </span>
                    {j.last_error && (
                      <span className="text-amber-600">{j.last_error}</span>
                    )}
                    {["RUNNING", "QUEUED"].includes(j.status) && (
                      <button
                        className="underline"
                        onClick={async () => {
                          await projectApi(
                            currentProject.id,
                            `jobs/${j.id}/cancel`,
                            "POST",
                          );
                          await reload();
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
};
