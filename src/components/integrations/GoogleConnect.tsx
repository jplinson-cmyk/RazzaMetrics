import React, { useEffect, useState } from "react";
import { listProperties, GscSite } from "../../services/searchConsole";
import { disconnectGoogle } from "../../services/googleAuth";
import { useProject } from "../../context/ProjectContext";
export const GoogleConnect: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentGscProperty?: string;
  onPropertySelected: (property: string) => void;
}> = ({ isOpen, onClose, projectId, currentGscProperty }) => {
  const { updateProject, reload } = useProject();
  const [properties, setProperties] = useState<GscSite[]>([]);
  const [selected, setSelected] = useState(currentGscProperty || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setSelected(currentGscProperty || "");
    setError("");
    setLoading(true);
    listProperties()
      .then(setProperties)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isOpen, projectId, currentGscProperty]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-6 space-y-5">
        <h2 className="font-heading font-bold dark:text-white">
          Google Search Console
        </h2>
        <p className="text-xs text-gray-500">
          Choose a property you can access. Property permission and website
          matching are checked on the server. Saving starts historical
          synchronization.
        </p>
        {loading && <p role="status">Loading properties…</p>}
        {error && (
          <p role="alert" className="text-xs text-rose-500">
            {error}
          </p>
        )}
        <select
          aria-label="Search Console property"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full p-3 rounded-xl border dark:bg-dark-surface dark:text-white"
        >
          <option value="">Select a verified property</option>
          {properties
            .filter((p) => p.permissionLevel !== "siteUnverifiedUser")
            .map((p) => (
              <option key={p.siteUrl}>{p.siteUrl}</option>
            ))}
        </select>
        <div className="flex flex-wrap gap-3 text-xs">
          <a
            className="text-blue-600 underline"
            href={"/api/auth/login?project=" + encodeURIComponent(projectId)}
          >
            Connect / reconnect Google
          </a>
          <button
            onClick={async () => {
              try {
                await disconnectGoogle(projectId);
                await reload();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Disconnect account
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button className="p-2 text-gray-500" onClick={onClose}>
            Close
          </button>
          <button
            disabled={!selected || !projectId}
            className="px-4 py-2 bg-razza-500 text-white rounded-xl disabled:opacity-50"
            onClick={async () => {
              await updateProject({ gscProperty: selected });
              onClose();
            }}
          >
            Save property
          </button>
        </div>
      </div>
    </div>
  );
};
