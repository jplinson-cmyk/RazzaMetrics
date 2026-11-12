import { z } from "zod";
import { Env, stmt } from "./core";
export const settingsSchema = z.object({
  toxicity: z
    .object({
      suspiciousTldPoints: z.number().min(0).max(15).default(10),
      lowPageRankThreshold: z.number().min(0).max(10).default(1),
      lowPageRankPoints: z.number().min(0).max(30).default(20),
      exactMatchAnchorPoints: z.number().min(0).max(40).default(25),
      spamPatternPoints: z.number().min(0).max(30).default(15),
      sitewideLinkPoints: z.number().min(0).max(20).default(10),
      noAnchorPenalty: z.literal(0).default(0),
    })
    .default({
      suspiciousTldPoints: 10,
      lowPageRankThreshold: 1,
      lowPageRankPoints: 20,
      exactMatchAnchorPoints: 25,
      spamPatternPoints: 15,
      sitewideLinkPoints: 10,
      noAnchorPenalty: 0,
    }),
  opportunities: z
    .object({
      minImpressions: z.number().int().min(0).max(1e9).default(100),
      lowCtrPercent: z.number().min(0).max(100).default(2),
      minPosition: z.number().min(1).max(100).default(4),
      maxPosition: z.number().min(1).max(100).default(20),
    })
    .default({
      minImpressions: 100,
      lowCtrPercent: 2,
      minPosition: 4,
      maxPosition: 20,
    }),
});
export async function settings(env: Env, projectId: string) {
  const row = await stmt(
    env,
    "SELECT data FROM project_settings WHERE project_id=?",
    projectId,
  ).first<{ data: string }>();
  return settingsSchema.parse(row ? JSON.parse(row.data) : {});
}
