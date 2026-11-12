/**
 * Razza Metrics — Backlink Toxicity Scoring Engine v1.0
 *
 * This is a Razza-specific heuristic scoring engine.
 * It is NOT an official Google toxicity score.
 * Scores are based on configurable signals and must never auto-disavow.
 */

export interface ToxicitySignal {
  code: string;
  label: string;
  points: number;
  detected: boolean;
  evidence?: string;
  known?: boolean;
}

export interface ToxicityResult {
  score: number; // 0-100
  category: "low" | "moderate" | "high" | "critical";
  signals: ToxicitySignal[];
  explanation: string;
}

export interface ToxicityConfig {
  suspiciousTldPoints: number; // default: 20
  lowPageRankThreshold: number; // default: 1.0
  lowPageRankPoints: number; // default: 20
  exactMatchAnchorPoints: number; // default: 25
  spamPatternPoints: number; // default: 15
  sitewideLinkPoints: number; // default: 10
  noAnchorPenalty: number; // default: 0 (not penalized)
}

const DEFAULT_CONFIG: ToxicityConfig = {
  suspiciousTldPoints: 10,
  lowPageRankThreshold: 1.0,
  lowPageRankPoints: 20,
  exactMatchAnchorPoints: 25,
  spamPatternPoints: 15,
  sitewideLinkPoints: 10,
  noAnchorPenalty: 0,
};

// TLDs that are weak signals of spam (not proof)
const SUSPICIOUS_TLDS = [
  ".xyz",
  ".top",
  ".click",
  ".info",
  ".online",
  ".site",
  ".website",
  ".space",
  ".icu",
  ".buzz",
  ".gq",
  ".ml",
  ".cf",
  ".ga",
  ".tk",
  ".loan",
  ".win",
  ".bid",
  ".download",
  ".review",
  ".date",
];

// Spam anchor patterns (regex)
const SPAM_ANCHOR_PATTERNS = [
  /\b(buy|cheap|free|discount|sale|price|order|shop|casino|poker|pills|viagra|cialis|loan|credit|debt|payday|weight loss|diet|earn money|work from home)\b/i,
  /^click here$/i,
  /^here$/i,
  /^this$/i,
];

// Arrays represent an immutable import dataset. Cache frequencies to keep scoring linear.
const countsCache = new WeakMap<
  BacklinkInput[],
  {
    domains: Map<string, number>;
    anchors: Map<string, number>;
    knownAnchors: number;
  }
>();
function counts(links: BacklinkInput[]) {
  let result = countsCache.get(links);
  if (!result) {
    result = { domains: new Map(), anchors: new Map(), knownAnchors: 0 };
    for (const link of links) {
      result.domains.set(
        link.sourceDomain,
        (result.domains.get(link.sourceDomain) || 0) + 1,
      );
      if (link.anchorText) {
        const anchor = link.anchorText.trim().toLowerCase();
        result.anchors.set(anchor, (result.anchors.get(anchor) || 0) + 1);
        result.knownAnchors++;
      }
    }
    countsCache.set(links, result);
  }
  return result;
}
function isSitewideLink(
  domain: string,
  allBacklinks: BacklinkInput[],
): boolean {
  return (counts(allBacklinks).domains.get(domain) || 0) >= 5;
}

export interface BacklinkInput {
  id: string;
  sourceDomain: string;
  sourceUrl?: string;
  anchorText?: string;
  openPagerank?: number;
  linkType?: string;
}

export function scoreBacklink(
  backlink: BacklinkInput,
  allBacklinks: BacklinkInput[],
  config: ToxicityConfig = DEFAULT_CONFIG,
): ToxicityResult {
  const signals: ToxicitySignal[] = [];
  let rawPoints = 0;

  // Signal 1: Suspicious TLD
  const tldMatch = SUSPICIOUS_TLDS.find((tld) =>
    backlink.sourceDomain.endsWith(tld),
  );
  const hasSuspiciousTld = !!tldMatch;
  const tldPoints = hasSuspiciousTld ? config.suspiciousTldPoints : 0;
  rawPoints += tldPoints;
  signals.push({
    code: "suspicious_tld",
    label: "Suspicious TLD",
    points: tldPoints,
    detected: hasSuspiciousTld,
    known: !!backlink.sourceDomain,
    evidence: hasSuspiciousTld
      ? `Domain uses ${tldMatch} TLD — a weak spam signal requiring additional review`
      : undefined,
  });

  // Signal 2: Low Open PageRank
  let oprPoints = 0;
  let oprDetected = false;
  if (backlink.openPagerank !== undefined) {
    if (backlink.openPagerank < config.lowPageRankThreshold) {
      oprPoints = config.lowPageRankPoints;
      oprDetected = true;
    }
  }
  rawPoints += oprPoints;
  signals.push({
    code: "low_pagerank",
    label: "Low Open PageRank",
    points: oprPoints,
    detected: oprDetected,
    known: backlink.openPagerank !== undefined,
    evidence:
      backlink.openPagerank !== undefined
        ? `Open PageRank: ${backlink.openPagerank}`
        : "Open PageRank not yet fetched — signal unknown",
  });

  // Signal 3: Spam anchor text
  let anchorPoints = 0;
  let anchorDetected = false;
  const anchor = (backlink.anchorText || "").trim();
  if (anchor) {
    const spamMatch = SPAM_ANCHOR_PATTERNS.find((p) => p.test(anchor));
    const repeated =
      counts(allBacklinks).anchors.get(anchor.toLowerCase()) || 0;
    if (
      spamMatch &&
      repeated >= 5 &&
      repeated / Math.max(1, counts(allBacklinks).knownAnchors) >= 0.5
    ) {
      anchorPoints = config.exactMatchAnchorPoints;
      anchorDetected = true;
    }
  }
  rawPoints += anchorPoints;
  signals.push({
    code: "spam_anchor",
    label: "Spam Anchor Text",
    points: anchorPoints,
    detected: anchorDetected,
    known: !!anchor,
    evidence: anchorDetected
      ? `Anchor "${anchor}" matches spam pattern`
      : undefined,
  });

  // Signal 4: Spam URL patterns
  const spamUrlPatterns = [
    /free-seo|cheap-links|buy-backlinks|link-farm|auto-approve/i,
    /\.php\?id=\d{4,}/i,
    /index\.php\?.*rand/i,
  ];
  const url = backlink.sourceUrl || "";
  const hasSpamUrl = spamUrlPatterns.some((p) => p.test(url));
  const spamUrlPoints = hasSpamUrl ? config.spamPatternPoints : 0;
  rawPoints += spamUrlPoints;
  signals.push({
    code: "spam_url_pattern",
    label: "Spam URL Pattern",
    points: spamUrlPoints,
    detected: hasSpamUrl,
    known: !!backlink.sourceUrl,
    evidence: hasSpamUrl
      ? `URL pattern suggests automated or spam link placement`
      : undefined,
  });

  // Signal 5: Sitewide linking
  const sitewide = isSitewideLink(backlink.sourceDomain, allBacklinks);
  const sitewidePoints = sitewide ? config.sitewideLinkPoints : 0;
  rawPoints += sitewidePoints;
  signals.push({
    code: "sitewide_link",
    label: "Sitewide Linking Pattern",
    points: sitewidePoints,
    detected: sitewide,
    known: !!backlink.sourceUrl,
    evidence: sitewide
      ? `5+ links from ${backlink.sourceDomain} suggest sitewide placement`
      : undefined,
  });

  // Normalize to 0–100
  const maxPossible =
    config.suspiciousTldPoints +
    config.lowPageRankPoints +
    config.exactMatchAnchorPoints +
    config.spamPatternPoints +
    config.sitewideLinkPoints;
  const onlyTld = signals
    .filter((s) => s.detected)
    .every((s) => s.code === "suspicious_tld");
  const score = Math.min(
    onlyTld ? 29 : 100,
    Math.round((rawPoints / Math.max(1, maxPossible)) * 100),
  );

  let category: ToxicityResult["category"];
  if (score >= 80) category = "critical";
  else if (score >= 60) category = "high";
  else if (score >= 30) category = "moderate";
  else category = "low";

  const detectedSignals = signals.filter((s) => s.detected);
  const explanation =
    detectedSignals.length === 0
      ? "No configured risk signals detected in available attributes. Unknown attributes are not evidence of safety."
      : `${detectedSignals.length} risk signal(s) detected: ${detectedSignals.map((s) => s.label).join(", ")}. Score: ${score}/100.`;

  return { score, category, signals, explanation };
}

export interface ProjectToxicityReport {
  aggregateScore: number;
  evaluatedCount: number;
  unevaluatedCount: number;
  lowCount: number;
  moderateCount: number;
  highCount: number;
  criticalCount: number;
  coveragePct: number;
  topRiskLinks: Array<BacklinkInput & { result: ToxicityResult }>;
}

export function scoreProject(
  backlinks: BacklinkInput[],
  config: ToxicityConfig = DEFAULT_CONFIG,
): ProjectToxicityReport {
  const results: Array<BacklinkInput & { result: ToxicityResult }> = [];

  for (const bl of backlinks) {
    const result = scoreBacklink(bl, backlinks, config);
    results.push({ ...bl, result });
  }

  const evaluated = results.length;
  const unevaluated = 0; // All are evaluated by this engine

  const lowCount = results.filter((r) => r.result.category === "low").length;
  const moderateCount = results.filter(
    (r) => r.result.category === "moderate",
  ).length;
  const highCount = results.filter((r) => r.result.category === "high").length;
  const criticalCount = results.filter(
    (r) => r.result.category === "critical",
  ).length;

  const aggregateScore =
    evaluated > 0
      ? Math.round(results.reduce((a, r) => a + r.result.score, 0) / evaluated)
      : 0;

  const coveragePct = backlinks.length > 0 ? 100 : 0;

  const topRiskLinks = results
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 20);

  return {
    aggregateScore,
    evaluatedCount: evaluated,
    unevaluatedCount: unevaluated,
    lowCount,
    moderateCount,
    highCount,
    criticalCount,
    coveragePct,
    topRiskLinks,
  };
}
