import React, { useState } from "react";
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Search,
  Link2,
  ShieldAlert,
  FileCheck2,
  FileText,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { Logo } from "../brand/Logo";

export type ActiveTab =
  | "overview"
  | "pages"
  | "issues"
  | "rankings"
  | "organic"
  | "backlinks"
  | "toxicity"
  | "onpage";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const navItems: {
  id: ActiveTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  group?: string;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "organic", label: "Organic Keywords", icon: Search },
  { id: "pages", label: "Top Pages", icon: FileText },
  { id: "backlinks", label: "Backlink Profile", icon: Link2 },
  { id: "onpage", label: "Site Audit", icon: FileCheck2 },
  { id: "rankings", label: "Keyword Ranking", icon: TrendingUp, badge: "Rank", group: "More tools" },
  { id: "toxicity", label: "Toxicity Score", icon: ShieldAlert, badge: "Spam", group: "More tools" },
  { id: "issues", label: "Issue Tracker", icon: AlertTriangle, badge: "Audit", group: "More tools" },
];

export const navGroups = [...new Set(navItems.map((i) => i.group).filter(Boolean))] as string[];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isAuditing, auditProgress, runFullSiteAudit, issues, organicKeywords, snapshot, currentProject } = useProject();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("razza_sidebar_collapsed") === "true",
  );
  const counts: Partial<Record<ActiveTab, number>> = {
    organic: organicKeywords.length,
    pages: new Set(snapshot?.performance.map((r) => r.page).filter(Boolean)).size,
    backlinks: currentProject.referringDomainsCount,
    onpage: snapshot?.findings.length ?? 0,
    issues: issues.filter((i) => i.status !== "resolved").length,
  };

  const item = (entry: (typeof navItems)[number]) => {
    const Icon = entry.icon;
    const count = counts[entry.id] ?? 0;
    return (
      <button
        key={entry.id}
        type="button"
        title={entry.label}
        aria-label={collapsed ? entry.label : undefined}
        aria-current={activeTab === entry.id ? "page" : undefined}
        onClick={() => setActiveTab(entry.id)}
        className="nav-item"
      >
        <Icon className="nav-icon" />
        {!collapsed && <span className="nav-label">{entry.label}</span>}{" "}
        {!collapsed && (count > 0 ? (
          <span className="nav-count" aria-label={`${count} items`}>{count.toLocaleString()}</span>
        ) : entry.badge ? (
          <span className="nav-badge">{entry.badge}</span>
        ) : null)}
      </button>
    );
  };

  return (
    <aside data-collapsed={collapsed} className="app-sidebar hidden lg:flex">
      <div className="sidebar-brand">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className="brand-link"
          title="Go to Dashboard Overview"
        >
          <Logo compact={collapsed} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          onClick={() => {
            setCollapsed(!collapsed);
            localStorage.setItem("razza_sidebar_collapsed", String(!collapsed));
          }}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace tools">
        {navItems.filter((i) => !i.group).map(item)}
        {navGroups.map((group) => {
          const entries = navItems.filter((i) => i.group === group);
          // A collapsed rail shows every icon; groups only fold when there is room for labels.
          return collapsed ? (
            <div key={group} className="nav-group">{entries.map(item)}</div>
          ) : (
            <details key={group} className="nav-group" open>
              <summary className="nav-group-title">{group}</summary>
              {entries.map(item)}
            </details>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <button
          type="button"
          onClick={runFullSiteAudit}
          disabled={isAuditing}
          className="nav-item"
          title="Run a live audit of the current site"
          aria-label={collapsed ? "Run Live Audit" : undefined}
        >
          <RefreshCw className={`nav-icon ${isAuditing ? "animate-spin" : ""}`} />
          {!collapsed && (
            <span className="nav-label">
              {isAuditing ? `Auditing (${auditProgress}%)` : "Run Live Audit"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
