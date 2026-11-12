import type { Backlink } from "../src/db/schema";
import { budget, Env, external, HttpError, now, stmt } from "./core";
/** Optional fixed-egress adapter. No direct free-key call from a Worker. */
export async function enrichAuthority(env: Env, links: Backlink[]) {
  if (!env.OPEN_PAGERANK_ADAPTER_URL) return;
  const endpoint = new URL(env.OPEN_PAGERANK_ADAPTER_URL);
  if (endpoint.protocol !== "https:")
    throw new HttpError(503, "Authority adapter must use HTTPS.");
  const domains = [...new Set(links.map((b) => b.sourceDomain))];
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < domains.length; i += 100) {
    const part = domains.slice(i, i + 100);
    statements.push(
      stmt(
        env,
        `SELECT domain,score,fetched_at FROM domain_authority_cache WHERE domain IN (${part.map(() => "?").join(",")})`,
        ...part,
      ),
    );
  }
  const cached = statements.length
    ? (
        await env.DB.batch<{
          domain: string;
          score: number;
          fetched_at: string;
        }>(statements)
      ).flatMap((r) => r.results)
    : [];
  const valid = new Map(
    cached
      .filter((r) => Date.parse(r.fetched_at) > Date.now() - 30 * 86400000)
      .map((r) => [r.domain, r.score]),
  );
  for (const link of links)
    if (valid.has(link.sourceDomain))
      link.openPagerank = valid.get(link.sourceDomain);
  const missing = domains.filter((domain) => !valid.has(domain)).slice(0, 100);
  // Adapter is responsible for provider IP allowlisting and honoring Retry-After.
  for (let offset = 0; offset < missing.length; offset += 100) {
    await budget(
      env,
      "global",
      "openpagerank",
      Number(env.DAILY_OPEN_PAGERANK_REQUEST_LIMIT || 10),
    );
    const domains = missing.slice(offset, offset + 100);
    const data = await (
      await external(endpoint.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.OPEN_PAGERANK_ADAPTER_TOKEN
            ? { Authorization: `Bearer ${env.OPEN_PAGERANK_ADAPTER_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ domains }),
      })
    ).json<{ results: { domain: string; score: number }[] }>();
    if (!Array.isArray(data.results))
      throw new HttpError(502, "Invalid authority adapter response.");
    const updates: D1PreparedStatement[] = [];
    for (const result of data.results) {
      if (
        !domains.includes(result.domain) ||
        !Number.isFinite(result.score) ||
        result.score < 0 ||
        result.score > 10
      )
        continue;
      updates.push(
        stmt(
          env,
          "INSERT INTO domain_authority_cache VALUES(?,?,?,?) ON CONFLICT(domain) DO UPDATE SET score=excluded.score,fetched_at=excluded.fetched_at,source=excluded.source",
          result.domain,
          result.score,
          now(),
          "Open PageRank via fixed-egress adapter",
        ),
      );
      links
        .filter((b) => b.sourceDomain === result.domain)
        .forEach((b) => {
          b.openPagerank = result.score;
        });
    }
    if (updates.length) await env.DB.batch(updates);
  }
}
