import React, { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { exportToCsv } from "../../utils/csvExport";
export const AuditHistory: React.FC = () => {
  const { snapshot, currentProject } = useProject();
  const [chosen, setChosen] = useState("");
  const [compared, setCompared] = useState("");
  const [severity, setSeverity] = useState("");
  const [category,setCategory]=useState('');
  const classify=(key:string)=>/canonical|noindex|nofollow|robots/.test(key)?'Indexability':/title|description/.test(key)?'Metadata':/h1|heading|content/.test(key)?'Content structure':/link|redirect/.test(key)?'Internal links':/alt|image/.test(key)?'Images':/speed|resource/.test(key)?'Performance':'Technical configuration';
  const audits = snapshot?.audits || [];
  const id = chosen || audits[0]?.id;
  const findings =
    snapshot?.findings.filter(
      (f) => f.auditId === id && (!severity || f.severity === severity) && (!category||classify(f.checkType)===category),
    ) || [];
  const previous =
    snapshot?.findings.filter((f) => f.auditId === compared) || [];
  const input =
    "p-2 text-xs rounded-lg border dark:border-dark-border dark:bg-dark-surface";
  return (
    <details className="p-4 rounded-xl border dark:border-dark-border bg-white dark:bg-dark-card text-xs dark:text-gray-300 space-y-3">
      <summary>Saved audit reports and comparisons</summary>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Audit issue category" className={input} value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{['Indexability','Metadata','Content structure','Internal links','Images','Performance','Technical configuration'].map(c=><option key={c}>{c}</option>)}</select>
        <select
          aria-label="Saved audit"
          className={input}
          value={id || ""}
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">Select audit</option>
          {audits.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id.slice(0, 8)} — {a.status} — {a.pagesCrawled || 0} pages
            </option>
          ))}
        </select>
        <select
          aria-label="Comparison audit"
          className={input}
          value={compared}
          onChange={(e) => setCompared(e.target.value)}
        >
          <option value="">Compare with…</option>
          {audits
            .filter((a) => a.id !== id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.id.slice(0, 8)} — {a.status}
              </option>
            ))}
        </select>
        <select
          aria-label="Finding severity"
          className={input}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="">All severities</option>
          {["error", "warning", "notice"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className={input}
          disabled={!findings.length}
          onClick={() =>
            exportToCsv(
              "razza-technical-audit",
              findings.map((f) => ({
                Project: currentProject.name,
                Domain: currentProject.domain,
                ReportDate: new Date().toISOString(),
                Source: "Server HTML crawl",
                Audit: id,
                Limitations: "Static HTML; only crawled pages checked",
                ...f,
              })),
            )
          }
        >
          Export saved audit CSV
        </button>
      </div>
      <p>
        {findings.length} displayed findings
        {compared
          ? `, ${previous.length} total findings in comparison run. Compare only completed runs with equivalent crawl scope.`
          : ""}
      </p>
      {snapshot?.pages
        .filter((p) => p.auditId === id)
        .map((p) => (
          <details
            key={p.url}
            className="p-2 border dark:border-dark-border rounded-lg"
          >
            <summary className="break-all">
              {p.url} — HTTP {p.statusCode}
              {p.analysisStatus && p.analysisStatus!=='complete' && ` — ${p.analysisStatus} (content not fully assessed)`}
            </summary>
            <p>Title: {p.title || "Missing"}</p>
            <ul className="space-y-2 mt-2">
              {findings
                .filter((f) => f.url === p.url)
                .map((f) => (
                  <li key={f.checkType}>
                    <strong>
                      {f.title} ({f.severity})
                    </strong>
                    <p>{f.description}</p>
                    <p className="break-all">
                      Evidence: {f.evidence || "See measured page attributes"}
                    </p>
                    <p>Recommended fix: {f.recommendation}</p>
                  </li>
                ))}
            </ul>
          </details>
        ))}
    </details>
  );
};
