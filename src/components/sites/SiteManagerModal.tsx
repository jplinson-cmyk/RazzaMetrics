import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { exportToCsv } from '../../utils/csvExport';
import { display } from '../../services/measurements';
import {
  X,
  Globe,
  Plus,
  Layers,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Download,
  Search,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface SiteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SiteManagerModal: React.FC<SiteManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    projects,
    currentProject,
    setCurrentProjectById,
    addNewProject,
    batchAddProjects,
    deleteProject
  } = useProject();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'list' | 'single' | 'batch'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Single site form
  const [singleDomain, setSingleDomain] = useState('');
  const [singleCode, setSingleCode] = useState('');

  // Batch site form
  const [batchInput, setBatchInput] = useState(
    ''
  );
  const [batchResult, setBatchResult] = useState<{ added: number; skipped: number } | null>(null);

  if (!isOpen) return null;

  const filteredProjects = projects.filter(
    p =>
      p.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleDomain.trim()) return;
    await addNewProject(singleDomain.trim(), singleCode.trim() || undefined);
    setSingleDomain('');
    setSingleCode('');
    setActiveTab('list');
  };

  const handleBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchInput.trim()) return;
    const result = await batchAddProjects(batchInput);
    setBatchResult(result);
    setTimeout(() => {
      setActiveTab('list');
      setBatchResult(null);
    }, 1200);
  };

  const handleDelete = (id: string, domain: string) => {
    if (window.confirm(`Are you sure you want to remove "${domain}" from your tracked portfolio?`)) {
      deleteProject(id);
    }
  };

  const handleExportSitesCsv = () => {
    const exportData = projects.map(p => ({
      ProjectName: p.name,
      Domain: p.domain,
      HealthScore: display(p.healthScore),
      CrawledPages: p.totalPagesCrawled,
      MonthlyOrganicTraffic: p.organicTrafficMonthly,
      TrackedKeywords: p.trackedKeywordsCount,
      ReferringDomains: p.referringDomainsCount,
      ToxicityScore: display(p.overallToxicityScore),
      CreatedDate: p.createdDate
    }));
    exportToCsv('razzaseo-all-tracked-sites', exportData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-dark-border flex items-center justify-between bg-gray-50/50 dark:bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-razza-50 dark:bg-razza-900/30 text-razza-600 dark:text-razza-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-gray-900 dark:text-white">
                  Multi-Site Portfolio Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-razza-500 text-white text-[10px] font-bold">
                  {projects.length} Sites
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-bold">
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track, audit, and compare multiple domains simultaneously
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-dark-border px-5 pt-2 gap-4 text-xs font-semibold bg-white dark:bg-dark-card">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'list'
                ? 'border-razza-500 text-razza-600 dark:text-razza-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            All Tracked Sites ({projects.length})
          </button>

          <button
            onClick={() => setActiveTab('single')}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'single'
                ? 'border-razza-500 text-razza-600 dark:text-razza-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            + Add Single Site
          </button>

          <button
            onClick={() => setActiveTab('batch')}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'batch'
                ? 'border-razza-500 text-razza-600 dark:text-razza-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Import Multiple</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Search & Export Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search sites by domain or name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('single')}
                    className="px-3 py-1.5 rounded-lg bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Site</span>
                  </button>

                  <button
                    onClick={handleExportSitesCsv}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Sites Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredProjects.map(proj => {
                  const isActive = proj.id === currentProject.id;
                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        isActive
                          ? 'border-razza-500 bg-razza-50/40 dark:bg-razza-900/10 ring-2 ring-razza-500/20'
                          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-heading font-bold text-sm text-gray-900 dark:text-white truncate">
                              {proj.name}
                            </h4>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded-full bg-razza-500 text-white text-[9px] font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate block mt-0.5">
                            {proj.domain}
                          </span>
                        </div>

                        {/* Health Score Pill */}
                        <div className="text-right flex-shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 font-heading font-bold text-xs">
                            Not scored Health
                          </span>
                        </div>
                      </div>

                      {/* Mini Metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-border text-[11px] text-gray-500">
                        <div>
                          <span className="block text-[10px] font-bold text-gray-400">Pages</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{proj.totalPagesCrawled}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-gray-400">Keywords</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{proj.trackedKeywordsCount}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-gray-400">Backlinks</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{proj.referringDomainsCount}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 pt-2.5 flex items-center justify-between gap-2">
                        {isActive ? (
                          <span className="text-xs text-razza-600 dark:text-razza-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Currently Selected
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setCurrentProjectById(proj.id);
                              onClose();
                            }}
                            className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-dark-hover hover:bg-razza-500 hover:text-white text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors"
                          >
                            Switch to this Site
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(proj.id, proj.domain)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Delete site from portfolio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'single' && (
            <form onSubmit={handleSingleAdd} className="space-y-4 max-w-lg mx-auto py-2">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-xs text-gray-600 dark:text-gray-300">
                <p className="font-semibold text-gray-900 dark:text-white mb-0.5">
                  Add a New Website to Track
                </p>
                <p>
                  Enter the domain. If it's verified in your connected Google account, Search Console and Analytics link automatically and the first audit starts right away.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Website Domain URL *
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme-consulting.com or https://client.org"
                  value={singleDomain}
                  onChange={e => setSingleDomain(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500 font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Project code (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RZ-104"
                  maxLength={40}
                  value={singleCode}
                  onChange={e => setSingleCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Track Website Now</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'batch' && (
            <form onSubmit={handleBatchAdd} className="space-y-4 max-w-lg mx-auto py-2">
              <div className="p-3.5 rounded-xl bg-razza-50/70 dark:bg-razza-950/30 border border-razza-200 dark:border-razza-800/40 text-xs text-razza-800 dark:text-razza-300">
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-razza-600" />
                  <span>Batch Import Agency Domains</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  Paste websites you manage, separated by newlines or commas. Each receives its own project; Google data requires authorized property access.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Domains List (One per line)
                </label>
                <textarea
                  rows={5}
                  value={batchInput}
                  onChange={e => setBatchInput(e.target.value)}
                  placeholder="domain1.com&#10;domain2.com&#10;domain3.org"
                  className="w-full p-3 text-xs rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500 font-mono leading-relaxed"
                  required
                />
              </div>

              {batchResult && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Successfully added <strong>{batchResult.added}</strong> new sites ({batchResult.skipped} duplicates skipped).
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-razza-500 hover:bg-razza-600 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Import All Domains</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50/50 dark:bg-dark-surface/50">
          <span className="text-[11px] text-gray-400">
            Active Site: <strong className="text-gray-700 dark:text-gray-200">{currentProject.domain}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-dark-border text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
