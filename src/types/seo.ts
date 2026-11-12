export interface User {
  id: string;
  name: string;
  email: string; // Must end in @razzaconsulting.com or admin
  avatar: string;
  role: 'Super Admin' | 'SEO Lead' | 'SEO Strategist' | 'Content Specialist' | 'Technical Auditor';
}

export type Severity = 'error' | 'warning' | 'notice';
export type IssueStatus = 'to-do' | 'in-progress' | 'resolved';
export type IssueCategory = 
  | 'Crawlability' 
  | 'HTTPS & Security' 
  | 'Meta Tags & Content' 
  | 'Links & Redirects' 
  | 'Performance & Core Web Vitals' 
  | 'Indexability';

export interface SeoIssue {
  id: string;
  title: string;
  category: IssueCategory;
  severity: Severity;
  count: number;
  affectedUrls: string[];
  explanation: string;
  howToFix: string[];
  status: IssueStatus;
  estimatedImpact: 'High' | 'Medium' | 'Low';
}

export interface TrackedKeyword {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  historyDates?: string[];
  id: string;
  keyword: string;
  currentRank: number;
  previousRank: number;
  change: number; // positive = improvement, negative = drop
  searchVolume: number;
  difficulty: number; // 0-100
  cpc: number;
  url: string;
  history: number[]; // Last 7 data points
  serpFeatures: ('Featured Snippet' | 'People Also Ask' | 'Local Pack' | 'SiteLinks' | 'Images' | 'Video' | 'Reviews' | 'Knowledge Panel')[];
  device: 'desktop' | 'mobile';
  location: string;
  tags: string[];
}

export type SearchIntent = 'Unknown' | 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

export interface OrganicKeyword {
  id: string;
  keyword: string;
  intent: SearchIntent;
  position: number;
  previousPosition: number;
  trafficEstimate: number;
  trafficPercentage: number;
  volume: number;
  kd: number;
  cpc: number;
  url: string;
  serpFeatures: string[];
}

export interface BacklinkItem {
  sourceDomain?: string;
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  authorityScore: number; // 0-100
  linkType: 'dofollow' | 'nofollow' | 'ugc' | 'sponsored' | 'unknown';
  firstSeen: string;
  lastSeen: string;
  toxicityScore: number; // 0-100
  toxicMarkers: string[];
  disavowStatus: 'none' | 'disavow-link' | 'disavow-domain' | 'whitelisted';
}

export interface ToxicMarkerDetail {
  code: string;
  title: string;
  description: string;
  detectedCount: number;
  severity: 'High' | 'Medium' | 'Low';
}

export interface OnPageCheckResult {
  id: string;
  category: 'Strategy' | 'Content' | 'Technical' | 'UX & Performance' | 'Backlinks';
  title: string;
  description: string;
  currentValue: string;
  recommendedValue: string;
  status: 'passed' | 'warning' | 'failed';
  priority: 'High' | 'Medium' | 'Low';
  checked: boolean;
}

export interface ProjectDomain {
  id: string;
  domain: string;
  name: string;
  createdDate: string;
  healthScore: number;
  totalPagesCrawled: number;
  organicTrafficMonthly: number;
  trackedKeywordsCount: number;
  referringDomainsCount: number;
  overallToxicityScore: number; // 0-100
  gscProperty?: string;
  lastSyncDate?: string;
  lastAuditDate?: string;
}

export interface WeeklyReport {
  id: string;
  generatedDate: string;
  weekLabel: string;
  domain: string;
  healthScore: number;
  healthScoreDelta: number;
  keywordsUp: number;
  keywordsDown: number;
  newBacklinks: number;
  lostBacklinks: number;
  resolvedIssues: number;
  newIssues: number;
  topWinningKeyword: string;
  topWinningRankDelta: string;
  dispatchedTo: string[];
  status: 'Delivered' | 'Scheduled' | 'Draft';
}

export interface SiteDataStore {
  issues: SeoIssue[];
  keywords: TrackedKeyword[];
  organicKeywords: OrganicKeyword[];
  backlinks: BacklinkItem[];
  onPageChecks: OnPageCheckResult[];
  weeklyReports: WeeklyReport[];
}
