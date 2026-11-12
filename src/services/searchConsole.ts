import { api, projectApi } from "./api";
export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}
export const listProperties = () => api<GscSite[]>("/google/properties");
export async function syncKeywordPerformance(
  projectId: string,
  _siteUrl: string,
  _days = 90,
  onProgress?: (message: string) => void,
) {
  const job = await projectApi<{ id: string }>(projectId, "jobs", "POST", {
    type: "gsc",
  });
  onProgress?.("Synchronization queued: " + job.id);
  return { synced: 0, errors: [] as string[], jobId: job.id };
}
