import type { Backlink, BacklinkImportBatch } from "../db/schema";
import { projectApi } from "./api";
export type ImportType = BacklinkImportBatch["importType"];
export interface ImportResult {
  batchId: string;
  importType: ImportType;
  rowsProcessed: number;
  rowsInserted: number;
  errors: string[];
  sample: Backlink[];
}
export async function importBacklinksFromCsv(
  projectId: string,
  file: File,
  _overrideType?: ImportType,
): Promise<ImportResult> {
  if (!file.name.toLowerCase().endsWith(".csv") || file.size > 1_000_000)
    throw new Error("Choose a CSV file up to 1 MB.");
  return projectApi(projectId, "backlinks/import", "POST", {
    filename: file.name,
    text: await file.text(),
  });
}
