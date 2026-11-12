import React, { useEffect, useState } from "react";
import { BarChart3, Check, Cog, Link2, RefreshCw, Search, ScanLine } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import { ProjectRules } from "./ProjectRules";
import { GoogleConnect } from "../integrations/GoogleConnect";

/**
 * The strip under the page title: what this site is connected to, the sync state, and the few actions
 * that matter. Dates, device and country live in the context bar; everything else sits in Settings.
 */
export const ProjectStatus: React.FC<{ onAddProject: () => void }> = ({ onAddProject }) => {
  const { currentProject, error, snapshot, reload, queueJob, updateProject, runFullSiteAudit, isAuditing } = useProject();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const onOpenGoogle = () => setGoogleOpen(true);
  const [name, setName] = useState(currentProject.name);
  const [code, setCode] = useState(currentProject.code || "");
  useEffect(() => {
    setName(currentProject.name);
    setCode(currentProject.code || "");
  }, [currentProject.id, currentProject.name, currentProject.code]);

  if (!currentProject.id)
    return (
      <section className="card empty-start">
        <h2>Add your first website</h2>
        <p>Enter a domain. If it's verified in your Google account, Search Console and Analytics connect on their own.</p>
        <button type="button" className="workspace-action" onClick={onAddProject}>
          Add project
        </button>
      </section>
    );

  const active = snapshot?.jobs.filter((j) => ["QUEUED", "RUNNING"].includes(j.status)) || [];
  const failed = snapshot?.jobs.filter((j) => j.last_error) || [];
  const chip = (linked: boolean, label: string, Icon: typeof Search) => (
    <button type="button" className={`status-chip ${linked ? "is-on" : "is-off"}`} onClick={onOpenGoogle} title={linked ? `${label} linked` : `${label} not linked: open Google settings`}>
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
      {linked ? <Check className="w-3.5 h-3.5" aria-label="linked" /> : <span className="status-chip-action">Link</span>}
    </button>
  );

  return (
    <div className="project-strip-wrap">
      {error && (
        <div role="alert" className="strip-alert">
          {error}
          <button type="button" className="card-link" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      )}
      <div className="project-strip">
        <div className="project-strip-status">
          {currentProject.code && <span className="project-code">{currentProject.code}</span>}
          {chip(!!currentProject.gscProperty, "Search Console", Search)}
          {chip(!!currentProject.ga4Property, "Analytics", BarChart3)}
          <span className="strip-meta">
            {active.length
              ? `${active.length} job${active.length > 1 ? "s" : ""} running`
              : currentProject.lastSyncDate
                ? `Synced ${new Date(currentProject.lastSyncDate).toLocaleDateString()}`
                : "Not synced yet"}
          </span>
        </div>
        <div className="project-strip-actions">
          <button type="button" className="btn-secondary" disabled={!currentProject.gscProperty} onClick={() => void queueJob("gsc")} title={currentProject.gscProperty ? "Fetch the latest Search Console data" : "Link Search Console first"}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Sync
          </button>
          <button type="button" className="btn-secondary" disabled={isAuditing} onClick={() => void runFullSiteAudit()}>
            <ScanLine className="w-4 h-4" aria-hidden="true" /> {isAuditing ? "Auditing…" : "Audit"}
          </button>
          <button type="button" className="btn-secondary" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
            <Cog className="w-4 h-4" aria-hidden="true" /> Settings
          </button>
        </div>
      </div>
      {failed.length > 0 && !settingsOpen && (
        <p className="strip-warning">
          {failed.length} background job{failed.length > 1 ? "s" : ""} reported a problem.{" "}
          <button type="button" className="card-link" onClick={() => setSettingsOpen(true)}>
            View
          </button>
        </p>
      )}

      {settingsOpen && (
        <section className="card settings-panel" aria-label="Project settings">
          <form
            className="settings-row"
            onSubmit={(e) => {
              e.preventDefault();
              void updateProject({ name: name.trim() || currentProject.name, code: code.trim() });
            }}
          >
            <label className="login-field">
              <span>Project name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </label>
            <label className="login-field">
              <span>Project code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="e.g. RZ-104" />
            </label>
            <button type="submit" className="btn-secondary">
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenGoogle}>
              <Link2 className="w-4 h-4" aria-hidden="true" /> Google
            </button>
          </form>

          {!!snapshot?.jobs.length && (
            <div>
              <h3 className="settings-heading">Background jobs</h3>
              <ul className="job-list">
                {snapshot.jobs.slice(0, 10).map((j) => (
                  <li key={j.id}>
                    <span className="job-type">{j.type === "gsc" ? "Search Console sync" : j.type === "crawl" ? "Site audit" : j.type === "pagespeed" ? "PageSpeed test" : j.type}</span>
                    <span className={`job-state job-state--${j.status.toLowerCase()}`}>{j.status.toLowerCase()} {j.progress}%</span>
                    {j.last_error && <span className="job-error">{j.last_error}</span>}
                    {["RUNNING", "QUEUED"].includes(j.status) && (
                      <button
                        type="button"
                        className="card-link"
                        onClick={async () => {
                          await projectApi(currentProject.id, `jobs/${j.id}/cancel`, "POST");
                          await reload();
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ProjectRules />
        </section>
      )}
      <GoogleConnect
        isOpen={googleOpen}
        onClose={() => setGoogleOpen(false)}
        projectId={currentProject.id}
        currentGscProperty={currentProject.gscProperty}
        onPropertySelected={() => undefined}
      />
    </div>
  );
};
