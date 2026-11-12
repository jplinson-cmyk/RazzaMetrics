export interface Project {
  id: string;
  name: string;
  domain: string;
  url: string;
  gscProperty?: string;
  status: 'active' | 'archived';
  healthScore: number;
  pagesCrawled: number;
  monthlyTraffic: number;
  trackedKeywordsCount: number;
  referringDomains: number;
  toxicityScore: number;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleConnection {
  id: string;
  projectId: string;
  email: string;
  accessToken: string;
  tokenExpiry: string;
  scopes: string;
  connectedAt: string;
  lastRefreshAt?: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface TrackedKeyword {
  id: string;
  projectId: string;
  keyword: string;
  targetUrl?: string;
  location: string;
  device: 'desktop' | 'mobile';
  tags: string;
  trackingSince: string;
  createdAt: string;
}

export interface GscPerformance {
  id: string;
  projectId: string;
  keyword: string;
  page: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  device: string;
  country: string;
  syncedAt: string;
}

export interface BacklinkImportBatch {
  id: string;
  projectId: string;
  filename: string;
  importType: 'external-links' | 'linking-sites' | 'linking-pages' | 'anchor-text' | 'latest-links' | 'manual';
  rowCount: number;
  importedAt: string;
  notes?: string;
}

export interface Backlink {
  discoveredAt?: string;
  id: string;
  projectId: string;
  batchId?: string;
  sourceDomain: string;
  sourceUrl?: string;
  targetUrl?: string;
  anchorText?: string;
  linkType?: string;
  firstSeen?: string;
  lastSeen?: string;
  openPagerank?: number;
  riskScore: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  riskSignals: string;
  disavowStatus: 'none' | 'disavow-link' | 'disavow-domain' | 'whitelisted';
  reviewed: boolean;
  notes?: string;
}

export interface DomainAuthority {
  domain: string;
  openPagerank: number;
  fetchedAt: string;
  source: string;
}

export interface ProjectToxicitySnapshot {
  id: string;
  projectId: string;
  calculatedAt: string;
  aggregateScore: number;
  evaluatedCount: number;
  unevaluatedCount: number;
  lowCount: number;
  moderateCount: number;
  highCount: number;
  criticalCount: number;
  coveragePct: number;
  methodologyVersion: string;
}

export interface AuditRun {
  id: string;
  projectId: string;
  runType: 'full-site' | 'single-page' | 'pagespeed';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  pagesCrawled: number;
  totalIssues: number;
  criticalIssues: number;
  errorMessage?: string;
  createdAt: string;
}

export interface PageAuditFinding {
  id: string;
  auditRunId: string;
  projectId: string;
  url: string;
  checkType: string;
  severity: 'error' | 'warning' | 'notice';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export interface PageSpeedResult {
  id: string;
  projectId: string;
  url: string;
  strategy: 'mobile' | 'desktop';
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seoScore: number | null;
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
  lighthouseJson?: string;
  testedAt: string;
}

export interface SeoIssue {
  id: string;
  projectId: string;
  url?: string;
  issueType: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'notice';
  status: 'open' | 'in-progress' | 'resolved';
  source: 'audit' | 'backlink' | 'toxicity' | 'manual';
  sourceRef?: string;
  evidence?: string;
  recommendation?: string;
  assignedTo?: string;
  fingerprint: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  count?: number;
  affectedUrls?: string;
  howToFix?: string;
  estimatedImpact?: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface BackgroundJob {
  id: string;
  projectId: string;
  jobType: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  payload?: string;
}
