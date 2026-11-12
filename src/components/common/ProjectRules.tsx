import React, { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { projectApi } from "../../services/api";
import { aggregate, display } from "../../services/measurements";
interface Rules {
  toxicity: {
    suspiciousTldPoints: number;
    lowPageRankThreshold: number;
    lowPageRankPoints: number;
    exactMatchAnchorPoints: number;
    spamPatternPoints: number;
    sitewideLinkPoints: number;
    noAnchorPenalty: 0;
  };
  opportunities: {
    minImpressions: number;
    lowCtrPercent: number;
    minPosition: number;
    maxPosition: number;
  };
}
const labels: Record<string, string> = {
  suspiciousTldPoints: "Weak TLD weight (maximum 15)",
  lowPageRankThreshold: "Low PageRank threshold",
  lowPageRankPoints: "Low PageRank weight",
  exactMatchAnchorPoints: "Repeated commercial anchor weight",
  spamPatternPoints: "Suspicious source URL weight",
  sitewideLinkPoints: "Repeated source-domain weight",
  minImpressions: "Minimum impressions",
  lowCtrPercent: "Low CTR threshold (%)",
  minPosition: "Minimum average position",
  maxPosition: "Maximum average position",
};
export const ProjectRules: React.FC = () => {
  const { currentProject, snapshot, queueJob } = useProject();
  const [rules, setRules] = useState<Rules | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setRules(null);
    if (currentProject.id)
      projectApi<Rules>(currentProject.id, "settings")
        .then(setRules)
        .catch((e) => setMessage(e.message));
  }, [currentProject.id]);
  if (!currentProject.id) return null;
  const queries = [
    ...new Set(snapshot?.performance.map((r) => r.keyword) || []),
  ].map((keyword) => ({
    keyword,
    ...aggregate(
      snapshot?.performance.filter((r) => r.keyword === keyword) || [],
    ),
  }));
  const opportunities = queries
    .filter(
      (q) =>
        rules &&
        q.impressions >= rules.opportunities.minImpressions &&
        q.ctr < rules.opportunities.lowCtrPercent &&
        q.position >= rules.opportunities.minPosition &&
        q.position <= rules.opportunities.maxPosition,
    )
    .sort((a, b) => b.impressions - a.impressions);
  return (
    <details className="p-3 rounded-xl border dark:border-dark-border bg-white dark:bg-dark-card text-xs text-gray-600 dark:text-gray-300">
      <summary>Project scoring rules and optimization opportunities</summary>
      {rules && (
        <form
          className="space-y-4 mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await projectApi(currentProject.id, "settings", "PUT", rules);
              await queueJob("toxicity");
              setMessage("Rules saved; risk recalculation requested.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          {(["toxicity", "opportunities"] as const).map((group) => (
            <fieldset key={group}>
              <legend className="font-bold capitalize mb-2">{group}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(rules[group])
                  .filter(([key]) => key !== "noAnchorPenalty")
                  .map(([key, value]) => (
                    <label key={key}>
                      {labels[key]}
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={value}
                        onChange={(e) =>
                          setRules({
                            ...rules,
                            [group]: {
                              ...rules[group],
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                        className="w-20 ml-2 p-1 rounded border dark:bg-dark-surface"
                      />
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          <button className="px-3 py-2 bg-razza-500 text-white rounded-lg">
            Save rules
          </button>
        </form>
      )}
      <p className="my-3">
        Opportunities meet all configured impression, CTR and position
        thresholds. These are optimization candidates, not traffic forecasts.
      </p>
      <ul>
        {opportunities.slice(0, 20).map((q) => (
          <li key={q.keyword}>
            {q.keyword}: {q.impressions} impressions, {display(q.ctr)}% CTR ·
            average position {display(q.position)}
          </li>
        ))}
      </ul>
      {message && <p role="status">{message}</p>}
    </details>
  );
};
