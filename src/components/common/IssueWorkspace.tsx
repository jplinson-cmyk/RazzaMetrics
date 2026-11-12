import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
export const IssueWorkspace: React.FC = () => {
  const { snapshot, currentProject, reload } = useProject();
  const [view, setView] = useState(
    () => localStorage.getItem("razza_issue_view") || "table",
  );
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const issues = (snapshot?.issues || []).filter((i) =>
    `${i.title} ${i.url || ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const update = async (id: string, status: string) => {
    setPending(id);
    setError("");
    try {
      await projectApi(currentProject.id, `issues/${id}`, "PATCH", { status });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  };
  const card = (i: (typeof issues)[number]) => (
    <article
      key={i.id}
      className="board-card"
      draggable={!pending}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
    >
      <strong>{i.title}</strong>
      <span className={`severity-${i.severity}`}>{i.severity}</span>
      <p className="break-all">{i.url || "Project task"}</p>
      <p>
        {i.assignedTo ? `Assigned to ${i.assignedTo}` : "Unassigned"} ·{" "}
        {new Date(i.updatedAt).toLocaleDateString()}
      </p>
      <details>
        <summary>Evidence and recommended fix</summary>
        <p>{i.description}</p>
        <p>{i.evidence || "No additional evidence"}</p>
        <p>{i.recommendation || "Review the issue."}</p>
      </details>
      <select
        aria-label={`Status for ${i.title}`}
        disabled={!!pending}
        value={i.status}
        onChange={(e) => void update(i.id, e.target.value)}
      >
        {["open", "in-progress", "resolved"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </article>
  );
  return (
    <section className="analytics-panel mb-6">
      <div className="analytics-heading">
        <div>
          <h2>Issue workspace</h2>
          <p>
            Drag cards between columns or use the status menu. Changes are shown
            after the server confirms them.
          </p>
        </div>
      </div>
      <div className="chart-toolbar">
        {["table", "kanban", "severity"].map((v) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => {
              setView(v);
              localStorage.setItem("razza_issue_view", v);
            }}
          >
            {v === "severity"
              ? "By severity"
              : v === "kanban"
                ? "Kanban board"
                : "Table view"}
          </button>
        ))}
        <input
          aria-label="Search issue workspace"
          placeholder="Find an issue or URL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {pending && <p role="status">Saving issue status…</p>}
      {view === "table" ? (
        <div className="overflow-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {issues.slice(0, 100).map((i) => (
                <tr key={i.id}>
                  <td>
                    <details>
                      <summary>{i.title}</summary>
                      <p>{i.description}</p>
                      <p>{i.evidence}</p>
                      <p>{i.recommendation}</p>
                    </details>
                    {i.url && /^https?:/.test(i.url) && (
                      <a href={i.url} target="_blank" rel="noreferrer">
                        Open affected page ↗
                      </a>
                    )}
                  </td>
                  <td>
                    <span className={`severity-${i.severity}`}>
                      {i.severity}
                    </span>
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${i.title}`}
                      value={i.status}
                      disabled={!!pending}
                      onChange={(e) => void update(i.id, e.target.value)}
                    >
                      {["open", "in-progress", "resolved"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>{i.assignedTo || "Unassigned"}</td>
                  <td>{new Date(i.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kanban-board">
          {(view === "kanban"
            ? ["open", "in-progress", "resolved"]
            : ["error", "warning", "notice"]
          ).map((group) => (
            <div
              key={group}
              className="kanban-column"
              onDragOver={(e) => {
                if (view === "kanban") e.preventDefault();
              }}
              onDrop={(e) => {
                if (view !== "kanban" || pending) return;
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (issues.some((i) => i.id === id)) void update(id, group);
              }}
            >
              <h3>
                {group.toUpperCase()}{" "}
                <span>
                  {
                    issues.filter(
                      (i) =>
                        (view === "kanban" ? i.status : i.severity) === group,
                    ).length
                  }
                </span>
              </h3>
              {issues
                .filter(
                  (i) => (view === "kanban" ? i.status : i.severity) === group,
                )
                .map(card)}
            </div>
          ))}
        </div>
      )}
      {!issues.length && (
        <div className="chart-empty">
          <strong>No matching issues</strong>
          <p>
            Create a task or run an audit. Existing issue tools below include
            comments and history.
          </p>
        </div>
      )}
    </section>
  );
};
