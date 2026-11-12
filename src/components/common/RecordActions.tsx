import React, { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import { display, aggregate } from "../../services/measurements";
import { RankTrendChart } from "./ChartComponents";
const input =
  "p-2 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface dark:text-white";
export const KeywordEvidence: React.FC<{ keyword?: string }> = ({
  keyword,
}) => {
  const { snapshot, currentProject, reload } = useProject();
  const [message, setMessage] = useState("");
  if (!keyword) return null;
  const records =
    snapshot?.performance.filter(
      (r) => r.keyword.toLowerCase() === keyword.toLowerCase(),
    ) || [];
  const totals = aggregate(records);
  return (
    <details className="p-4 rounded-xl border dark:border-dark-border bg-white dark:bg-dark-card text-xs dark:text-gray-300">
      <summary>Measurement details: {keyword}</summary>
      {snapshot?.keywords.some(
        (k) => k.keyword.toLowerCase() === keyword.toLowerCase(),
      ) && (
        <div className="flex flex-wrap gap-2 my-3">
          <button
            className={input}
            onClick={async () => {
              const record = snapshot.keywords.find(
                (k) => k.keyword.toLowerCase() === keyword.toLowerCase(),
              )!;
              const updated = prompt("Tracked keyword", keyword);
              if (!updated) return;
              try {
                await projectApi(
                  currentProject.id,
                  `keywords/${record.id}`,
                  "PATCH",
                  { keyword: updated },
                );
                await reload();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Edit keyword
          </button>
          <button
            className={input}
            onClick={async () => {
              const record = snapshot.keywords.find(
                (k) => k.keyword.toLowerCase() === keyword.toLowerCase(),
              )!;
              const targetUrl = prompt(
                "Target page URL",
                record.targetUrl || "https://" + currentProject.domain + "/",
              );
              if (!targetUrl) return;
              try {
                await projectApi(
                  currentProject.id,
                  `keywords/${record.id}`,
                  "PATCH",
                  { targetUrl },
                );
                await reload();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Set target page
          </button>
        </div>
      )}
      {message && <p role="alert">{message}</p>}
      <p className="my-3">
        Clicks {display(totals.clicks)}, Impressions{" "}
        {display(totals.impressions)}, CTR {display(totals.ctr)}%, Average
        position {display(totals.position)}
      </p>
      {(["page", "device", "country"] as const).map((key) => (
        <div key={key} className="my-3">
          <strong>{key}</strong>
          <ul className="space-y-1">
            {[...new Set(records.map((r) => r[key]))].map((value) => {
              const a = aggregate(records.filter((r) => r[key] === value));
              return (
                <li key={value} className="break-all">
                  {value}: {a.clicks} clicks, {a.impressions} impressions,
                  average position {display(a.position)}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </details>
  );
};
export const IssueActions: React.FC = () => {
  const { currentProject, snapshot, reload } = useProject();
  const [id, setId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<unknown[]>([]);
  const issues = snapshot?.issues || [];
  const issue = issues.find((i) => i.id === id);
  useEffect(() => {
    setId("");
    setHistory([]);
  }, [currentProject.id]);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([
      projectApi<unknown[]>(currentProject.id, `issues/${id}/comments`),
      projectApi<unknown[]>(currentProject.id, `issues/${id}/events`),
    ])
      .then(([comments, events]) => {
        if (alive) setHistory([...comments, ...events]);
      })
      .catch((e) => setMessage(e.message));
    return () => {
      alive = false;
    };
  }, [id, currentProject.id, snapshot]);
  async function perform(path: string, method: string, body?: unknown) {
    try {
      await projectApi(currentProject.id, path, method, body);
      await reload();
      setMessage("Saved.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details className="p-4 rounded-xl border dark:border-dark-border bg-white dark:bg-dark-card text-xs space-y-3 dark:text-gray-300">
      <summary>Edit, assign, comment, and review issue history</summary>
      <select
        aria-label="Issue to edit"
        className={input}
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">Select issue</option>
        {issues.map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
          </option>
        ))}
      </select>
      {issue && (
        <div className="space-y-3">
          <p>{issue.description}</p>
          <p className="break-all">
            Evidence: {issue.evidence || "No additional evidence supplied"}
          </p>
          <p>Recommendation: {issue.recommendation || "Review the issue."}</p>
          <div className="flex flex-wrap gap-2">
            <button
              className={input}
              onClick={() => {
                const title = prompt("Issue title", issue.title);
                if (title) void perform(`issues/${id}`, "PATCH", { title });
              }}
            >
              Edit title
            </button>
            <button
              className={input}
              onClick={() => {
                const assignedTo = prompt(
                  "Assign to (name or email)",
                  issue.assignedTo || "",
                );
                if (assignedTo !== null)
                  void perform(`issues/${id}`, "PATCH", { assignedTo });
              }}
            >
              Assign
            </button>
            <select
              aria-label="Issue severity"
              className={input}
              value={issue.severity}
              onChange={(e) =>
                void perform(`issues/${id}`, "PATCH", {
                  severity: e.target.value,
                })
              }
            >
              {["error", "warning", "notice"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {issue.source === "manual" && (
              <button
                className={input}
                onClick={() => {
                  if (confirm("Delete this manually created issue?"))
                    void perform(`issues/${id}`, "DELETE");
                }}
              >
                Delete issue
              </button>
            )}
          </div>
          <textarea
            aria-label="Issue comment"
            className={input + " w-full"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note"
          />
          <button
            className={input}
            disabled={!notes.trim()}
            onClick={() => {
              void perform(`issues/${id}/comments`, "POST", { body: notes });
              setNotes("");
            }}
          >
            Add comment
          </button>
          <details>
            <summary>Saved comments and events ({history.length})</summary>
            <pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto">
              {JSON.stringify(history, null, 2)}
            </pre>
          </details>
        </div>
      )}
      <button
        className={input}
        disabled={!issues.length}
        onClick={async () => {
          if (!confirm("Mark all currently open project issues in progress?"))
            return;
          for (const i of issues.filter((i) => i.status === "open"))
            await perform(`issues/${i.id}`, "PATCH", { status: "in-progress" });
        }}
      >
        Bulk start open issues
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
};
export const BacklinkActions: React.FC = () => {
  const { snapshot, currentProject, reload } = useProject();
  const [id, setId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const link = snapshot?.backlinks.find((b) => b.id === id);
  useEffect(() => {
    setId("");
    setNotes("");
  }, [currentProject.id]);
  async function save(data: unknown) {
    try {
      await projectApi(currentProject.id, `backlinks/${id}`, "PATCH", data);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <details className="p-4 rounded-xl border dark:border-dark-border bg-white dark:bg-dark-card text-xs space-y-3 dark:text-gray-300">
      <summary>Backlink review, evidence, and import history</summary>
      <p>
        Imported observations are unverified. Unknown attributes remain unknown.
        A risk score alone is insufficient reason to disavow a link.
      </p>
      <select
        aria-label="Backlink to review"
        className={input}
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          setNotes(
            snapshot?.backlinks.find((b) => b.id === e.target.value)?.notes ||
              "",
          );
        }}
      >
        <option value="">Select backlink</option>
        {snapshot?.backlinks.map((b) => (
          <option key={b.id} value={b.id}>
            {b.sourceUrl || b.sourceDomain}
          </option>
        ))}
      </select>
      {link && (
        <div className="space-y-3">
          <p className="break-all">
            Target: {link.targetUrl || "Unknown"}, Anchor:{" "}
            {link.anchorText || "Unknown"}
          </p>
          <p>
            First imported: {link.firstSeen}, Last observed in import:{" "}
            {link.lastSeen}
          </p>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(JSON.parse(link.riskSignals || "[]"), null, 2)}
          </pre>
          <textarea
            aria-label="Backlink review notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={input + " w-full"}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={input}
              onClick={() => void save({ notes, reviewed: true })}
            >
              Save review
            </button>
            <button
              className={input}
              onClick={() =>
                void save({
                  notes,
                  reviewed: true,
                  falsePositive: true,
                  disavowStatus: "whitelisted",
                })
              }
            >
              Flag false positive
            </button>
            <button
              className={input}
              onClick={async () => {
                try {
                  await projectApi(currentProject.id, "issues", "POST", {
                    title: "Review backlink from " + link.sourceDomain,
                    description:
                      notes ||
                      "Review the imported backlink and scoring evidence.",
                    url: link.targetUrl,
                    issueType: "backlink_review",
                    severity: "notice",
                  });
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Create review issue
            </button>
          </div>
        </div>
      )}
      <ul>
        {snapshot?.imports.map((b) => (
          <li key={b.id}>
            {b.filename}: {b.rowCount} rows, {b.importedAt}
            {b.rows && (
              <details>
                <summary>Imported aggregate rows</summary>
                <pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto">
                  {JSON.stringify(b.rows, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </details>
  );
};
export const ToxicityHistory: React.FC = () => {
  const { snapshot } = useProject();
  const history = [...(snapshot?.toxicity || [])].reverse();
  return (
    <div className="tool-panel p-4 text-xs dark:text-gray-300">
      <p>
        Razza heuristic, not an official Google score. Mean of evaluated
        observation scores. Low scores do not establish safety.
      </p>
      <p className="mt-2">
        Evaluated-record coverage:{" "}
        {display(history[history.length - 1]?.coveragePct)}%, Known-attribute
        coverage: {display(history[history.length - 1]?.attributeCoveragePct)}%
      </p>
      <RankTrendChart
        data={history
          .filter((h) => h.aggregateScore !== null)
          .map((h) => h.aggregateScore!)}
        labels={history
          .filter((h) => h.aggregateScore !== null)
          .map((h) => h.calculatedAt.slice(0, 10))}
        keyword="Stored risk history"
      />
    </div>
  );
};
