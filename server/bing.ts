import Papa from "papaparse";
import { budget, Env, HttpError } from "./core";

const API = "https://ssl.bing.com/webmaster/api.svc/json/";

async function bing<T>(env: Env, method: string, params: Record<string, string>): Promise<T> {
  const url = `${API}${method}?${new URLSearchParams({ ...params, apikey: env.BING_WEBMASTER_API_KEY! })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await response.json<{ d?: T; Message?: string; ErrorCode?: number }>().catch(() => ({}) as { d?: T; Message?: string });
  if (!response.ok || body.d === undefined)
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      `Bing Webmaster Tools: ${(body as { Message?: string }).Message || `HTTP ${response.status}`}. Check the site is added and verified in Bing Webmaster Tools.`,
    );
  return body.d;
}

/**
 * Inbound links Bing has found for the site, as backlink CSV text for the normal import.
 * Bing lists linked pages (GetLinkCounts), then the pages linking to each (GetUrlLinks).
 * shortcut: first result page for the 20 most-linked pages (21 requests, under the free plan's 50 per request); page through more if sites need it.
 */
export async function bingBacklinksCsv(env: Env, siteUrl: string) {
  if (!env.BING_WEBMASTER_API_KEY)
    throw new HttpError(503, "Add a free Bing Webmaster Tools API key (BING_WEBMASTER_API_KEY) to import links from Bing.");
  await budget(env, "global", "bing", Number(env.DAILY_BING_REQUEST_LIMIT || 50));
  const counts = await bing<{ Links?: { Url: string; Count: number }[] }>(env, "GetLinkCounts", { siteUrl, page: "0" });
  const pages = (counts.Links || []).sort((a, b) => b.Count - a.Count).slice(0, 20);
  const rows: { "source url": string; "target url": string; "anchor text": string }[] = [];
  for (const p of pages) {
    const links = await bing<{ Details?: { Url: string; AnchorText?: string }[] }>(env, "GetUrlLinks", { siteUrl, link: p.Url, page: "0" });
    for (const l of links.Details || []) rows.push({ "source url": l.Url, "target url": p.Url, "anchor text": l.AnchorText || "" });
  }
  // The importer takes up to 500 rows per batch and rejects malformed URLs, so keep only http(s) sources.
  const usable = rows.filter((r) => /^https?:\/\//i.test(r["source url"]) && /^https?:\/\//i.test(r["target url"])).slice(0, 500);
  return { csv: usable.length ? Papa.unparse(usable) : "", pages: pages.length, links: usable.length };
}
