import React from "react";
import { useProject } from "../../context/ProjectContext";
import { display } from "../../services/measurements";
export const ToolInsights: React.FC<{
  tool: "backlinks" | "toxicity" | "onpage";
}> = ({ tool }) => {
  const { snapshot, currentProject } = useProject();
  const links = snapshot?.backlinks || [];
  const assessed = links.filter((b) => b.riskCategory !== "unknown");
  const latest = snapshot?.toxicity[0];
  const groups =
    tool === "onpage"
      ? ["error", "warning", "notice"].map((key) => ({
          key,
          label:
            key === "error"
              ? "Critical findings"
              : key === "warning"
                ? "Warnings"
                : "Notices",
          count:
            snapshot?.findings.filter(
              (f) => f.auditId === snapshot.audits[0]?.id && f.severity === key,
            ).length || 0,
        }))
      : ["low", "moderate", "high", "critical", "unknown"].map((key) => ({
          key,
          label: key === "unknown" ? "Not evaluated" : key + " risk",
          count: links.filter((b) => b.riskCategory === key).length,
        }));
  const max = Math.max(1, ...groups.map((g) => g.count));
  const colors = ["var(--color-cool)", "var(--color-ink-2)", "var(--color-accent)", "var(--color-bad)", "var(--color-muted)"];
  return (
    <section className="analytics-panel">
      <div className="analytics-heading">
        <div>
          <h2>
            {tool === "onpage"
              ? "Audit findings at a glance"
              : "Backlink evidence & coverage"}
          </h2>
          <p>
            {tool === "onpage"
              ? "Latest saved audit findings by severity"
              : "Imported observations, internal heuristic, not a Google score"}
          </p>
        </div>
        <span>
          {tool === "onpage"
            ? snapshot?.audits[0]?.status || "No audit"
            : `${assessed.length} / ${links.length} evaluated`}
        </span>
      </div>
      <div className="premium-two mt-5">
        <div className="space-y-3">
          {groups.map((g, i) => (
            <div key={g.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="capitalize">{g.label}</span>
                <strong>{g.count}</strong>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${(g.count / max) * 100}%`,
                    background: colors[i],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
          {tool === "onpage" ? (
            <>
              <p>
                Measured health:{" "}
                <strong>
                  {display(currentProject.healthScore)}
                  {Number.isFinite(currentProject.healthScore) ? "%" : ""}
                </strong>
              </p>
              <p>
                Fully analyzed pages without critical findings, from the latest
                completed crawl. Blocked or JavaScript-dependent responses are
                excluded.
              </p>
              <p>
                Use Saved audit reports below to compare runs and inspect fixes.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>
                  {new Set(links.map((b) => b.sourceDomain)).size}
                </strong>{" "}
                unique referring domains
              </p>
              <p>
                Coverage: <strong>{display(latest?.coveragePct)}%</strong> of
                imported records evaluated
              </p>
              <p>
                Last calculation:{" "}
                {latest
                  ? new Date(latest.calculatedAt).toLocaleString()
                  : "Not calculated"}
              </p>
              <p>
                Authority and missing link attributes remain unknown. High risk
                is a review signal, not a disavow instruction.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
