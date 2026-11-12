import { CommandPalette } from "../common/CommandPalette";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useProject } from "../../context/ProjectContext";
import { GoogleConnect } from "../integrations/GoogleConnect";
import {
  Sun,
  Moon,
  Globe,
  Plus,
  Mail,
  LogOut,
  ChevronDown,
  Menu,
  Sparkles,
  ExternalLink,
  Layers,
  Shield,
  Trash2,
  Chrome,
} from "lucide-react";

interface NavbarProps {
  onOpenMobileMenu: () => void;
  onOpenWeeklyReport: () => void;
  onOpenSiteManager: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobileMenu,
  onOpenWeeklyReport,
  onOpenSiteManager,
}) => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    projects,
    currentProject,
    setCurrentProjectById,
    addNewProject,
    deleteProject,
    updateProject,
  } = useProject();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [isGoogleConnectOpen, setIsGoogleConnectOpen] = useState(false);

  const handleCreateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    addNewProject(newDomainInput.trim());
    setNewDomainInput("");
    setIsAddingDomain(false);
    setIsProjectDropdownOpen(false);
  };

  return (
    <header className="app-topbar">
      {/* Left: where you are (menu on phones, the site switcher, its sync state) */}
      <div className="topbar-group min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="icon-button lg:hidden"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project Selector Dropdown */}
        <div className="relative min-w-0">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={isProjectDropdownOpen}
            onClick={() => {
              setIsProjectDropdownOpen(!isProjectDropdownOpen);
              setIsUserDropdownOpen(false);
            }}
            className="site-switcher"
            title="Switch site"
          >
            <Globe className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="min-w-0 text-left">
              <span className="block text-sm font-medium truncate max-w-[180px]">
                {currentProject.name}
              </span>
              <span className="hidden sm:block font-mono text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                {currentProject.domain}
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          </button>

          {/* Dropdown Menu */}
          {isProjectDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xl p-2 z-50 animate-fadeIn">
              <div className="px-2 py-1.5 flex items-center justify-between text-xs font-bold text-gray-400 dark:text-gray-500">
                <span>Tracked Sites ({projects.length})</span>
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    onOpenSiteManager();
                  }}
                  className="text-[10px] text-razza-600 dark:text-razza-400 hover:underline capitalize"
                >
                  Manage All
                </button>
              </div>

              <div className="space-y-1 my-1 max-h-56 overflow-y-auto">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                      proj.id === currentProject.id
                        ? "bg-razza-50 dark:bg-razza-900/30 text-razza-700 dark:text-razza-300 font-semibold"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setCurrentProjectById(proj.id);
                        setIsProjectDropdownOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left pr-2"
                    >
                      <p className="truncate font-medium">{proj.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {proj.domain}
                      </p>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-dark-border font-bold">
                        Not scored
                      </span>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete ${proj.domain}?`)) {
                              deleteProject(proj.id);
                            }
                          }}
                          className="p-1 rounded text-gray-400 hover:text-rose-600"
                          title="Delete site"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-dark-border space-y-1">
                {isAddingDomain ? (
                  <form onSubmit={handleCreateDomain} className="space-y-2 p-1">
                    <input
                      type="text"
                      placeholder="e.g. clientdomain.com"
                      value={newDomainInput}
                      onChange={(e) => setNewDomainInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-razza-500 font-mono"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="submit"
                        className="flex-1 py-1 px-2 rounded-lg bg-razza-500 text-white text-xs font-medium hover:bg-razza-600"
                      >
                        Add Domain
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingDomain(false)}
                        className="py-1 px-2 rounded-lg bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setIsAddingDomain(true)}
                      className="flex items-center justify-center gap-1 p-1.5 rounded-lg text-xs font-semibold text-razza-600 dark:text-razza-400 hover:bg-razza-50 dark:hover:bg-razza-900/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Site</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        onOpenSiteManager();
                      }}
                      className="flex items-center justify-center gap-1 p-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                    >
                      <Layers className="w-3.5 h-3.5 text-razza-500" />
                      <span>Batch Import</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <span
          className="hidden xl:block text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
          title="Last successful Search Console synchronization"
        >
          {currentProject.lastSyncDate
            ? `Synced ${new Date(currentProject.lastSyncDate).toLocaleDateString()}`
            : "Not synchronized"}
        </span>
      </div>

      {/* Middle: search everything in the current project */}
      <div className="topbar-search">
        <CommandPalette />
      </div>

      {/* Right: data source, report, appearance, account */}
      <div className="topbar-group">
        <button
          type="button"
          onClick={() => setIsGoogleConnectOpen(true)}
          className="topbar-button"
          title={
            currentProject.gscProperty
              ? `Search Console connected: ${currentProject.gscProperty}`
              : "Search Console not connected"
          }
        >
          <Chrome className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">GSC</span>
          <span className="hidden md:inline text-gray-500 dark:text-gray-400">
            {currentProject.gscProperty ? "connected" : "off"}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenWeeklyReport}
          className="topbar-button"
          title="Export project reports"
        >
          <Mail className="w-4 h-4" />
          <span className="hidden md:inline">Weekly Report</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="icon-button"
          title={
            theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* User Profile */}
        {user && (
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isUserDropdownOpen}
              onClick={() => {
                setIsUserDropdownOpen(!isUserDropdownOpen);
                setIsProjectDropdownOpen(false);
              }}
              className="topbar-button"
            >
              <img
                src={user.avatar || "/favicon.svg"}
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xl p-3 z-50 animate-fadeIn">
                <div className="pb-2.5 border-b border-gray-100 dark:border-dark-border">
                  <div className="font-bold text-xs text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                    <span>{user.name}</span>
                  </div>
                  <div className="text-[11px] text-razza-600 dark:text-razza-400 font-medium truncate">
                    {user.email}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isAdmin
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                          : "bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="py-2 space-y-1 text-xs">
                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      onOpenSiteManager();
                    }}
                    className="w-full flex items-center justify-between p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover text-left"
                  >
                    <span>Manage Sites ({projects.length})</span>
                    <Layers className="w-3 h-3 text-razza-500" />
                  </button>

                  <a
                    href="https://workflow.razzaconsulting.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                  >
                    <span>Razza WorkFlow</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-dark-border">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Search Console Connect Modal */}
      <GoogleConnect
        isOpen={isGoogleConnectOpen}
        onClose={() => setIsGoogleConnectOpen(false)}
        projectId={currentProject.id}
        currentGscProperty={currentProject.gscProperty}
        onPropertySelected={(property) => {
          void updateProject({ gscProperty: property });
        }}
      />
    </header>
  );
};
