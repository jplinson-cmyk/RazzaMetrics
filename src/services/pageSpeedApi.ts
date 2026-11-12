import type { PageSpeedResult } from "../db/schema";
import { projectApi } from "./api";
export interface PageSpeedApiResult {
  mobile?: PageSpeedResult;
  desktop?: PageSpeedResult;
  error?: string;
}
export async function runPageSpeedTest(
  projectId: string,
  url: string,
  _apiKey?: string,
  strategies: ("mobile" | "desktop")[] = ["mobile", "desktop"],
): Promise<PageSpeedApiResult> {
  for (const strategy of strategies)
    await projectApi(projectId, "jobs", "POST", {
      type: "pagespeed",
      url,
      strategy,
    });
  return {};
}
