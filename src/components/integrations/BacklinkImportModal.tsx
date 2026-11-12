import React, { useState, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  X,
  Layers,
} from "lucide-react";
import {
  importBacklinksFromCsv,
  ImportResult,
  ImportType,
} from "../../services/backlinkImport";

interface BacklinkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onImportComplete: () => void;
}

export const BacklinkImportModal: React.FC<BacklinkImportModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<ImportType | "auto">("auto");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setResult(null);
      setConfirmed(false);
      setPreview([]);
      setColumns([]);
      const file = e.target.files[0];
      if (file.size > 1_000_000 || !file.name.toLowerCase().endsWith(".csv")) {
        setError("Select a CSV file up to 1 MB.");
        return;
      }
      const parsed = Papa.parse<Record<string, string>>(await file.text(), {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length) {
        setError("Invalid CSV: " + parsed.errors[0].message);
        return;
      }
      if (!parsed.data.length || parsed.data.length > 500) {
        setError("Import between 1 and 500 rows per file.");
        return;
      }
      setColumns(parsed.meta.fields || []);
      setPreview(parsed.data.slice(0, 3));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a CSV file to upload.");
      return;
    }
    if (!confirmed || !preview.length) {
      setError("Review the preview and confirm before importing.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const res = await importBacklinksFromCsv(
        projectId,
        selectedFile,
        importType === "auto" ? undefined : importType,
      );
      setResult(res);
      onImportComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import backlinks",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `Source URL,Target URL,Anchor Text,Date Discovered\nhttps://techblog.com/seo-guide,https://example.com/services,seo services,2026-01-15\nhttps://marketingdaily.org/review,https://example.com/,expert agency,2026-02-01\nhttps://spammy-links.xyz/directory,https://example.com/blog,click here,2026-02-10\n`;
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-gsc-backlinks.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-6 space-y-5">
        <ol className="flex justify-between text-[11px] text-slate-500">
          <li>1. Select CSV</li>
          <li className={preview.length ? "text-blue-600" : ""}>
            2. Preview & validate
          </li>
          <li className={result ? "text-emerald-600" : ""}>
            3. Import results
          </li>
        </ol>
        {preview.length > 0 && !result && (
          <div className="space-y-3 text-xs">
            <p className="font-semibold">
              Detected fields: {columns.join(", ")}
            </p>
            <div className="overflow-auto max-h-40">
              <table className="premium-table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c}>{row[c] || "Unknown"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed these fields and want to import this file. Missing
              attributes remain unknown.
            </label>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-razza-50 dark:bg-razza-900/30 flex items-center justify-center text-razza-600 dark:text-razza-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-gray-900 dark:text-white">
                Import Google Search Console Backlinks
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload CSV exported from Google Search Console Links report
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guidance Box */}
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-700 dark:text-gray-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-razza-600 dark:text-razza-400" />
              How to export from Google Search Console:
            </span>
            <button
              onClick={downloadSampleCsv}
              className="text-razza-600 dark:text-razza-400 hover:underline flex items-center gap-1 font-medium text-[11px]"
            >
              <Download className="w-3.5 h-3.5" /> Download Sample CSV
            </button>
          </div>
          <ol className="list-decimal list-inside text-gray-500 dark:text-gray-400 space-y-0.5 text-[11px]">
            <li>Open Google Search Console → Links report</li>
            <li>
              Click <strong>Export</strong> in the top-right corner (Top linking
              sites / pages)
            </li>
            <li>
              Select <strong>Download CSV</strong>
            </li>
            <li>Upload the downloaded file below</li>
          </ol>
        </div>

        {/* File dropzone / selector */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Export Type
            </label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-razza-500"
            >
              <option value="auto">Auto-detect from CSV columns</option>
              <option value="external-links">External Links (Detailed)</option>
              <option value="linking-sites">Top Linking Sites / Domains</option>
              <option value="linking-pages">Top Linking Pages (Target)</option>
              <option value="anchor-text">Top Linking Anchor Text</option>
              <option value="latest-links">Latest Links</option>
            </select>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl p-6 text-center cursor-pointer hover:border-razza-500 transition-colors bg-gray-50/50 dark:bg-dark-surface/50"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              {selectedFile ? selectedFile.name : "Click to select CSV file"}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Supports standard GSC Links CSV formats
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Import Complete!
              </div>
              <p className="text-[11px]">
                Processed <strong>{result.rowsProcessed}</strong> rows •
                Successfully imported <strong>{result.rowsInserted}</strong>{" "}
                backlinks (Type: {result.importType}).
              </p>
              {result.errors.length > 0 && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  Note: {result.errors.length} rows had warnings or skipped.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
            >
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || !confirmed || !preview.length}
                className="px-4 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploading ? "Saving imported records…" : "Confirm & Import"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
