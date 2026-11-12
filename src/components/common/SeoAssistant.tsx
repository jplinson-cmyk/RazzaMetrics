import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
interface Report {
  id: string;
  question: string;
  answer: string;
  model: string;
  createdAt: string;
}
export const SeoAssistant: React.FC = () => {
  const { currentProject } = useProject();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReports([]);
    setError("");
    setQuestion("");
    setBusy(false);
    let alive = true;
    if (open && currentProject.id)
      projectApi<{ models: string[]; reports: Report[] }>(
        currentProject.id,
        "ai",
      )
        .then((r) => {
          if (alive) {
            setModels(r.models);
            setModel(r.models[0]);
            setReports(r.reports);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [open, currentProject.id]);
  return (
    <>
      <button
        type="button"
        aria-label="SEO Assistant"
        className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40 workspace-action shadow-lg inline-flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">SEO Assistant</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex justify-end"
          onClick={() => setOpen(false)}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white dark:bg-dark-card h-full p-6 overflow-y-auto shadow-2xl space-y-4"
          >
            <div className="flex justify-between">
              <h2 className="font-heading font-bold text-xl">SEO Assistant</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close AI assistant"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-gray-500">
              NVIDIA development preview, Advice grounded in your saved GSC
              data and audit findings. Sending a question shares a limited
              project-data summary with NVIDIA. Suggestions require review;
              nothing is applied automatically.
            </p>
            {!currentProject.id ? (
              <p>Add or select a website first.</p>
            ) : (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const id = currentProject.id;
                  try {
                    const r = await projectApi<Report>(id, "ai", "POST", {
                      question,
                      model,
                    });
                    setReports((old) => [r, ...old]);
                    setQuestion("");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <select
                  aria-label="AI model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full border p-2 rounded dark:bg-dark-surface"
                >
                  {models.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <div className="flex gap-2 flex-wrap text-xs">
                  {[
                    "Prioritize SEO fixes",
                    "Suggest keyword ideas from my queries",
                    "Improve page titles and descriptions",
                    "Create a 30-day optimization plan",
                  ].map((p) => (
                    <button
                      type="button"
                      key={p}
                      className="border rounded-lg p-2"
                      onClick={() => setQuestion(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="SEO question"
                  className="border rounded-xl p-3 w-full dark:bg-dark-surface"
                  rows={4}
                  required
                  minLength={3}
                  maxLength={3000}
                  placeholder="Ask about this website…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  disabled={busy || !model}
                  className="workspace-action disabled:opacity-50"
                >
                  {busy ? "Analyzing saved evidence…" : "Get recommendations"}
                </button>
              </form>
            )}
            {error && (
              <p role="alert" className="text-rose-600 text-sm">
                {error}
              </p>
            )}
            {reports.map((r) => (
              <article key={r.id} className="border rounded-xl p-4 space-y-3">
                <h3 className="font-bold">{r.question}</h3>
                <p className="text-xs text-gray-500">
                  {r.model}, {new Date(r.createdAt).toLocaleString()} ·
                  AI-generated advice
                </p>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {r.answer}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
};
