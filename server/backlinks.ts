import Papa from "papaparse";
import { z } from "zod";
import { scoreBacklink, scoreProject } from "../src/services/toxicityEngine";
import type { Backlink } from "../src/db/schema";
import { digest, Env, HttpError, now, objects, stmt, uid } from "./core";
import { settings } from "./settings";
import { enrichAuthority } from "./authority";

export function parseBacklinkCsv(text: string) {
  if (text.length > 1_000_000)
    throw new HttpError(
      413,
      "CSV exceeds 1 MB. Split the export into smaller files.",
    );
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
  });
  if (parsed.errors.length)
    throw new HttpError(400, "Malformed CSV: " + parsed.errors[0].message);
  if (!parsed.data.length || parsed.data.length > 500)
    throw new HttpError(400, "Upload between 1 and 500 rows per batch.");
  const fields = parsed.meta.fields || [];
  const pick = (names: string[]) => fields.find((h) => names.includes(h));
  const source = pick([
    "source url",
    "source",
    "linking page",
    "linking pages",
    "referring page",
    "url",
  ]);
  const domain = pick([
    "domain",
    "source domain",
    "linking site",
    "linking sites",
    "top linking sites",
    "site",
  ]);
  const target = pick(["target url", "target page", "target", "destination"]);
  const anchor = pick([
    "anchor text",
    "anchor",
    "linking text",
    "top linking text",
  ]);
  const discovered = pick([
    "date discovered",
    "first discovered",
    "discovered date",
  ]);
  if (!source && !domain)
    throw new HttpError(
      400,
      "This aggregate export has no source domains or source URLs. Target-page and anchor-only reports cannot establish backlink relationships; use a linking-sites or latest/sample-links export.",
    );
  return parsed.data.map((r, i) => {
    const rawSource = source ? r[source]?.trim() : undefined;
    const rawDomain = domain ? r[domain]?.trim() : undefined;
    let u: URL;
    try {
      u = new URL(rawSource || `https://${rawDomain}`);
    } catch {
      throw new HttpError(400, `Invalid source on CSV row ${i + 2}.`);
    }
    if (
      !["https:", "http:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      !u.hostname.includes(".")
    )
      throw new HttpError(400, `Invalid source on CSV row ${i + 2}.`);
    const targetUrl =
      target && r[target]
        ? z.url({ protocol: /^https?$/ }).parse(r[target])
        : undefined;
    return {
      sourceDomain: u.hostname.toLowerCase().replace(/^www\./, ""),
      sourceUrl: rawSource ? u.href : undefined,
      targetUrl,
      anchorText: anchor ? r[anchor]?.trim() || undefined : undefined,
      discoveredAt:
        discovered && r[discovered]
          ? z.iso.date().parse(r[discovered].trim())
          : undefined,
    };
  });
}
export async function importCsv(
  env: Env,
  projectId: string,
  text: string,
  filename: string,
) {
  let parsed: ReturnType<typeof parseBacklinkCsv>;
  try {
    parsed = parseBacklinkCsv(text);
  } catch (e) {
    if (!(e instanceof HttpError) || !e.message.includes("aggregate")) throw e;
    const aggregate = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (
      !aggregate.meta.fields?.some((h) =>
        [
          "target page",
          "target url",
          "top linking text",
          "linking text",
          "anchor text",
        ].includes(h),
      )
    )
      throw e;
    const batchId = uid();
    await stmt(
      env,
      "INSERT INTO backlink_import_batches VALUES(?,?,?,?)",
      batchId,
      projectId,
      JSON.stringify({
        id: batchId,
        filename,
        importedAt: now(),
        rowCount: aggregate.data.length,
        importType: "aggregate-snapshot",
        rows: aggregate.data,
      }),
      now(),
    ).run();
    return {
      batchId,
      importType: "aggregate-snapshot",
      rowsProcessed: aggregate.data.length,
      rowsInserted: 0,
      errors: [
        "Saved aggregate report only. No source-to-target relationships were inferred. View the imported rows in import history.",
      ],
      sample: [],
    };
  }
  const time = now();
  const batchId = uid();
  const existing = await objects<Backlink>(env, "backlinks", projectId);
  const knownIds=new Set(existing.map(b=>b.id));
  const statements = [
    stmt(
      env,
      "INSERT INTO backlink_import_batches VALUES(?,?,?,?)",
      batchId,
      projectId,
      JSON.stringify({
        id: batchId,
        filename,
        importedAt: time,
        rowCount: parsed.length,
        importType: "gsc-csv",
      }),
      time,
    ),
  ];
  let inserted = 0;
  for (const row of parsed) {
    const key = JSON.stringify([
      row.sourceDomain,
      row.sourceUrl || "",
      row.targetUrl || "",
      row.anchorText || "",
    ]);
    const id = await digest(projectId + key);
    const old = existing.find((b) => b.id === id);
    if (!knownIds.has(id)) {inserted++;knownIds.add(id);}
    const link: Backlink = {
      ...old,
      ...row,
      id,
      projectId,
      batchId,
      firstSeen: old?.firstSeen || time,
      lastSeen: time,
      riskScore: old?.riskScore || 0,
      riskCategory: old?.riskCategory || "unknown",
      riskSignals: old?.riskSignals || "[]",
      reviewed: old?.reviewed || false,
      disavowStatus: old?.disavowStatus || "none",
    };
    statements.push(
      stmt(
        env,
        "INSERT INTO backlinks VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,identity_key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
        id,
        projectId,
        key,
        JSON.stringify(link),
        time,
        time,
      ),
    );
  }
  if(existing.length+inserted>5000)throw new HttpError(409,'Project backlink storage cap reached (5,000). Reimports are allowed; archive projects before adding new observations.');
  await env.DB.batch(statements);
  return {
    batchId,
    importType: "external-links",
    rowsProcessed: parsed.length,
    rowsInserted: inserted,
    errors: [],
    sample: [],
  };
}
export async function recalculate(
  env: Env,
  projectId: string,
  checkActive: () => Promise<void> = async () => {},
) {
  const links = await objects<Backlink>(env, "backlinks", projectId);
  try {
    await enrichAuthority(env, links);
  } catch (e) {
    await stmt(
      env,
      "INSERT INTO integration_sync_logs VALUES(?,?,?,?)",
      uid(),
      projectId,
      JSON.stringify({
        service: "openpagerank",
        status: "unavailable",
        message:
          e instanceof HttpError
            ? e.message
            : "Authority adapter unavailable; scoring continues with known attributes.",
      }),
      now(),
    ).run();
  }
  await checkActive();
  const config = (await settings(env, projectId)).toxicity;
  const report = scoreProject(links, config);
  const time = now();
  const statements = [];
  for (const link of links) {
    const result = scoreBacklink(link, links, config);
    link.riskScore = result.score;
    link.riskCategory = result.category;
    link.riskSignals = JSON.stringify(result.signals);
    statements.push(
      stmt(
        env,
        "UPDATE backlinks SET data=?,updated_at=? WHERE id=? AND project_id=?",
        JSON.stringify(link),
        time,
        link.id,
        projectId,
      ),
    );
    statements.push(
      stmt(
        env,
        "INSERT INTO backlink_risk_assessments VALUES(?,?,?,?,?)",
        uid(),
        projectId,
        link.id,
        JSON.stringify(result),
        time,
      ),
    );
  }
  statements.push(
    stmt(
      env,
      "INSERT INTO project_toxicity_snapshots VALUES(?,?,?,?)",
      uid(),
      projectId,
      JSON.stringify({
        ...report,
        topRiskLinks: undefined,
        aggregateScore: links.length ? report.aggregateScore : null,
        calculatedAt: time,
        methodologyVersion: "2",
        config,
        attributeCoveragePct: links.length
          ? Math.round(
              (100 *
                links.reduce(
                  (n, b) =>
                    n +
                    scoreBacklink(b, links, config).signals.filter(
                      (s) => s.known,
                    ).length,
                  0,
                )) /
                (links.length * 5),
            )
          : 0,
      }),
      time,
    ),
  );
  // Keep each batch below free-tier SQL statement limits. Assessments can resume idempotently by recalculation.
  for (let i = 0; i < statements.length; i += 1000) {
    await checkActive();
    await env.DB.batch(statements.slice(i, i + 1000));
  }
  return report;
}
