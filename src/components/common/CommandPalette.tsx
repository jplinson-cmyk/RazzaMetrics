import React, { useEffect, useRef, useState } from "react";
import { useProject } from "../../context/ProjectContext";
export const CommandPalette: React.FC = () => {
  const { snapshot } = useProject();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const show = () => dialog.current?.showModal();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const records = [
    ...(snapshot?.keywords.map((k) => ({
      label: k.keyword,
      type: "Tracked keyword",
      tab: "rankings",
    })) || []),
    ...(snapshot?.issues.map((i) => ({
      label: i.title,
      type: "Issue",
      tab: "issues",
    })) || []),
    ...(snapshot?.pages.map((p) => ({
      label: p.url,
      type: "Page",
      tab: "onpage",
    })) || []),
    ...(snapshot?.backlinks.map((b) => ({
      label: b.sourceUrl || b.sourceDomain,
      type: "Backlink",
      tab: "backlinks",
    })) || []),
  ];
  const results = records
    .filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);
  return (
    <>
      <button
        onClick={show}
        className="command-trigger"
        title="Search project (Ctrl+K)"
      >
        ⌕ <span>Search project</span> <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label="Search current project"
      >
        <div className="flex gap-3">
          <input
            autoFocus
            aria-label="Search keywords, pages, issues and backlinks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, issues, pages…"
            className="w-full border rounded-lg p-3 dark:bg-dark-surface"
          />
          <button onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <p className="text-xs text-slate-500 my-3">
          Current project only, loaded records, up to 30 results
        </p>
        <ul>
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="command-result"
                onClick={() => {
                  location.hash = r.tab;
                  dialog.current?.close();
                }}
              >
                <span>{r.label}</span>
                <small>{r.type} →</small>
              </button>
            </li>
          ))}
        </ul>
        {!results.length && (
          <p className="p-6 text-slate-500">No matching saved records.</p>
        )}
      </dialog>
    </>
  );
};
