import React, { useEffect, useState } from "react";
import { listProperties, GscSite } from "../../services/searchConsole";
import { disconnectGoogle } from "../../services/googleAuth";
import { api } from "../../services/api";
import { useProject } from "../../context/ProjectContext";

interface Ga4Property {
  property: string;
  displayName: string;
  account: string;
}

/**
 * Google for one site. Linking normally happens on its own (when a site is added, and right after
 * Google is connected); this panel shows the result and lets you link now or pick by hand.
 */
export const GoogleConnect: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentGscProperty?: string;
  onPropertySelected: (property: string) => void;
}> = ({ isOpen, onClose, projectId, currentGscProperty }) => {
  const { updateProject, reload, linkGoogle, currentProject } = useProject();
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [ga4, setGa4] = useState<Ga4Property[]>([]);
  const [gscSelected, setGscSelected] = useState(currentGscProperty || "");
  const [ga4Selected, setGa4Selected] = useState(currentProject.ga4Property || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setGscSelected(currentGscProperty || "");
    setGa4Selected(currentProject.ga4Property || "");
    setError("");
    setNotice("");
    setBusy(true);
    Promise.allSettled([listProperties(), api<Ga4Property[]>("/google/analytics-properties")])
      .then(([sites, props]) => {
        if (sites.status === "fulfilled") setGscSites(sites.value);
        if (props.status === "fulfilled") setGa4(props.value);
        const failed = [sites, props].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) setError(failed.reason?.message || "Could not read your Google properties.");
      })
      .finally(() => setBusy(false));
  }, [isOpen, projectId, currentGscProperty, currentProject.ga4Property]);

  if (!isOpen) return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="google-panel" role="dialog" aria-modal="true" aria-labelledby="google-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="google-title">Google for {currentProject.domain}</h2>
        <p className="google-lede">
          Sites verified in your Google account link automatically when you add them. Use the button below for sites added before Google was connected.
        </p>

        <dl className="google-status">
          <div>
            <dt>Search Console</dt>
            <dd>{currentProject.gscProperty || "Not linked"}</dd>
          </div>
          <div>
            <dt>Google Analytics</dt>
            <dd>{ga4.find((g) => g.property === currentProject.ga4Property)?.displayName || currentProject.ga4Property || "Not linked"}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="login-key login-key--primary"
          disabled={busy || !projectId}
          onClick={() =>
            run(async () => {
              const linked = await linkGoogle();
              setNotice(
                linked.gscProperty || linked.ga4Property
                  ? `Linked ${[linked.gscProperty && "Search Console", linked.ga4Property && "Analytics"].filter(Boolean).join(" and ")}.`
                  : "Nothing new to link. Either it is already linked, or this Google account has no verified property for this domain.",
              );
            })
          }
        >
          {busy ? "Working…" : "Link automatically"}
        </button>
        {notice && <p role="status" className="google-notice">{notice}</p>}
        {error && <p role="alert" className="login-error">{error}</p>}

        <details className="google-manual">
          <summary>Choose properties manually</summary>
          <label className="google-field">
            <span>Search Console property</span>
            <select value={gscSelected} onChange={(e) => setGscSelected(e.target.value)}>
              <option value="">Not linked</option>
              {gscSites
                .filter((p) => p.permissionLevel !== "siteUnverifiedUser")
                .map((p) => (
                  <option key={p.siteUrl}>{p.siteUrl}</option>
                ))}
            </select>
          </label>
          <label className="google-field">
            <span>Google Analytics 4 property</span>
            <select value={ga4Selected} onChange={(e) => setGa4Selected(e.target.value)}>
              <option value="">Not linked</option>
              {ga4.map((g) => (
                <option key={g.property} value={g.property}>
                  {g.displayName} ({g.account})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !projectId}
            onClick={() =>
              run(async () => {
                await updateProject({ gscProperty: gscSelected, ga4Property: ga4Selected });
                onClose();
              })
            }
          >
            Save properties
          </button>
        </details>

        <div className="google-foot">
          <a className="card-link" href={"/api/auth/login?project=" + encodeURIComponent(projectId)}>
            Connect or reconnect Google
          </a>
          <button
            type="button"
            className="card-link"
            onClick={() =>
              run(async () => {
                await disconnectGoogle(projectId);
                await reload();
                onClose();
              })
            }
          >
            Disconnect account
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
