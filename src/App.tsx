import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProjectProvider, useProject } from "./context/ProjectContext";
import { ProjectStatus } from "./components/common/ProjectStatus";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar, ActiveTab, navItems } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { LoginModal } from "./components/auth/LoginModal";
import { WeeklyReportModal } from "./components/email/WeeklyReportModal";
import { SiteManagerModal } from "./components/sites/SiteManagerModal";

// Tools
import { PremiumDashboard as DashboardOverview, OverviewSkeleton, TableSkeleton } from "./components/common/PremiumDashboard";
import { TopPages } from "./components/tools/TopPages";
import { ContextBar } from "./components/explorer/ContextBar";
import { ContourField } from "./components/auth/ContourField";
import { IssueTracker } from "./components/tools/IssueTracker";
import { KeywordRanking } from "./components/tools/KeywordRanking";
import { OrganicKeywords } from "./components/tools/OrganicKeywords";
import { BacklinkAudit } from "./components/tools/BacklinkAudit";
import { ToxicityScore } from "./components/tools/ToxicityScore";
import { OnPageChecker } from "./components/tools/OnPageChecker";

// Mobile Bottom Bar Icons
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Link2,
  FileCheck2,
} from "lucide-react";

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const { currentProject, loading } = useProject();
  const tabs: ActiveTab[] = navItems.map((i) => i.id);
  const readTab = () =>
    tabs.includes(location.hash.slice(1) as ActiveTab)
      ? (location.hash.slice(1) as ActiveTab)
      : "overview";
  const [activeTab, setTab] = useState<ActiveTab>(readTab);
  const setActiveTab = (tab: ActiveTab) => {
    location.hash = tab;
    setTab(tab);
  };
  useEffect(() => {
    document.title = `${navItems.find((i) => i.id === activeTab)?.label ?? activeTab} · Razza Metrics`;
  }, [activeTab]);
  useEffect(() => {
    const change = () => setTab(readTab());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState(false);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);

  if (!user) return <LoginModal isOpen />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex flex-col font-sans">
      {/* If user is not authenticated, show Login Screen */}
      {!user && <LoginModal isOpen={true} />}

      <div className="flex h-dvh overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Mobile Navigation Drawer */}
        <MobileNav
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Content Area */}
        <div className="app-column">
          <ContourField className="app-backdrop" />
        <div className="app-scroll flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 lg:pb-0">
          <div className="app-chrome">
            <Navbar
              onOpenMobileMenu={() => setIsMobileNavOpen(true)}
              onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
              onOpenSiteManager={() => setIsSiteManagerOpen(true)}
            />
            {currentProject.id && <ContextBar activeTab={activeTab} onNavigate={setActiveTab} />}
          </div>

          <main className="app-main">
            <div className="workspace-heading">
              <div>
                <h1>{navItems.find((i) => i.id === activeTab)?.label}</h1>
                <p>
                  {currentProject.domain ||
                    "Your websites, insights, and next steps in one place."}
                </p>
              </div>
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => setIsSiteManagerOpen(true)}
              >
                + Add website
              </button>
            </div>

            {currentProject.id ? (
              <details className="setup-fold">
                <summary className="text-sm font-semibold">
                  Date range, filters & project setup{" "}
                  <span className="text-xs font-normal text-slate-500">
                    — adjust your reporting period
                  </span>
                </summary>
                <div className="mt-4">
                  <ProjectStatus
                    onAddProject={() => setIsSiteManagerOpen(true)}
                  />
                </div>
              </details>
            ) : (
              <ProjectStatus onAddProject={() => setIsSiteManagerOpen(true)} />
            )}
            {currentProject.id && loading && (activeTab === "overview" ? <OverviewSkeleton /> : <TableSkeleton />)}
            {currentProject.id && !loading && (
              <div key={currentProject.id} className="view">
                {activeTab === "overview" && (
                  <DashboardOverview
                    onNavigateTab={(tab) => setActiveTab(tab)}
                    onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
                    onOpenSiteManager={() => setIsSiteManagerOpen(true)}
                  />
                )}
                {activeTab === "issues" && <IssueTracker />}
                {activeTab === "rankings" && <KeywordRanking />}
                {activeTab === "organic" && <OrganicKeywords />}
                {activeTab === "backlinks" && <BacklinkAudit />}
                {activeTab === "toxicity" && <ToxicityScore />}
                {activeTab === "onpage" && <OnPageChecker />}
                {activeTab === "pages" && <TopPages />}
              </div>
            )}
          </main>
        </div>
        </div>
      </div>

      {/* Weekly Report Modal */}
      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        onClose={() => setIsWeeklyReportOpen(false)}
      />

      {/* Multi-Site Portfolio Hub Modal */}
      <SiteManagerModal
        isOpen={isSiteManagerOpen}
        onClose={() => setIsSiteManagerOpen(false)}
      />

      {/* Mobile Bottom Quick Action Bar for Phones */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-dark-surface border-t border-gray-200 dark:border-dark-border px-2 py-1 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-colors ${
            activeTab === "overview"
              ? "text-razza-600 dark:text-razza-400 font-bold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("issues")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-colors ${
            activeTab === "issues"
              ? "text-razza-600 dark:text-razza-400 font-bold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <AlertTriangle className="w-4 h-4 mb-0.5" />
          <span>Audit</span>
        </button>

        <button
          onClick={() => setActiveTab("rankings")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-colors ${
            activeTab === "rankings"
              ? "text-razza-600 dark:text-razza-400 font-bold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <TrendingUp className="w-4 h-4 mb-0.5" />
          <span>Rank</span>
        </button>

        <button
          onClick={() => setActiveTab("backlinks")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-colors ${
            activeTab === "backlinks"
              ? "text-razza-600 dark:text-razza-400 font-bold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <Link2 className="w-4 h-4 mb-0.5" />
          <span>Links</span>
        </button>

        <button
          onClick={() => setActiveTab("onpage")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-colors ${
            activeTab === "onpage"
              ? "text-razza-600 dark:text-razza-400 font-bold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <FileCheck2 className="w-4 h-4 mb-0.5" />
          <span>On-Page</span>
        </button>
      </nav>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <MainLayout />
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
