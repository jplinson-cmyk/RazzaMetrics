export interface PageAnalysis {
  url: string;
  statusCode: number;
  title?: string;
  description?: string;
  findings: {
    checkType: string;
    severity: "error" | "warning" | "notice";
    title: string;
    description: string;
    evidence?: string;
    recommendation: string;
  }[];
  h1Tags: string[];
  canonicalUrl?: string;
  noindex: boolean;
  viewport: boolean;
  images: { src: string; alt?: string; hasAlt: boolean }[];
  internalLinks: string[];
  externalLinks: string[];
  wordCount: number;
  fetchedAt: string;
  hasSitemap?: boolean;
  hasRobots?: boolean;
  https: boolean;
}
