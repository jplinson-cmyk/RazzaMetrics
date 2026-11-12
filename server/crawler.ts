import { load } from "cheerio";
import robotsParser from "robots-parser";
import { budget, Env, external, HttpError } from "./core";
export interface Finding {
  checkType: string;
  severity: "error" | "warning" | "notice";
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
}
export const USER_AGENT = "RazzaSEO-Crawler/2.0";
export function validateTarget(value: string, domain: string): URL {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new HttpError(400, "Invalid crawl URL.");
  }
  const host = u.hostname.toLowerCase();
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    host !== domain ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    /(^|\.)(localhost|internal|local|test|invalid)$/.test(host) ||
    host === "metadata.google.internal"
  )
    throw new HttpError(
      400,
      "Crawls require HTTPS on the exact project hostname and a public DNS name.",
    );
  u.hash = "";
  return u;
}
export function publicAddress(ip: string): boolean {
  if (ip.includes(":")) {
    // Fail closed for mapped, translated, link-local, local and special IPv6.
    return (
      /^[23][0-9a-f]{0,3}:/i.test(ip) &&
      !/^2001:(db8|0:|10:|20:)/i.test(ip) &&
      !ip.includes(".")
    );
  }
  const n = ip.split(".").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x) || x < 0 || x > 255))
    return false;
  const [a, b] = n;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}
async function validateDns(host: string) {
  const results = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const r = await external(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      return r.json<{
        Status: number;
        Answer?: { type: number; data: string }[];
      }>();
    }),
  );
  if (results.some((r) => r.Status !== 0))
    throw new HttpError(400, "DNS verification failed.");
  const addresses = results
    .flatMap((r) => r.Answer || [])
    .filter((r) => [1, 28].includes(r.type));
  if (!addresses.length || addresses.some((r) => !publicAddress(r.data)))
    throw new HttpError(
      400,
      "Target resolves to a nonpublic or unsupported address.",
    );
}
export async function safeFetch(env: Env, value: string, domain: string, allowed?: (url:string)=>boolean) {
  let url = validateTarget(value, domain);
  const chain: string[] = [];
  for (let hop = 0; hop < 6; hop++) {
    if(allowed && !allowed(url.href))throw new HttpError(403,'robots.txt disallows this URL or its redirect destination.');
    if (chain.includes(url.href))
      throw new HttpError(400, "Redirect loop detected.");
    chain.push(url.href);
    await validateDns(url.hostname);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(
        Number(env.CRAWLER_REQUEST_TIMEOUT_MS || 10000),
      ),
      headers: {
        "User-Agent": env.CRAWLER_USER_AGENT || USER_AGENT,
        Accept: "text/html,application/xml,text/plain",
      },
    });
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("Location")
    ) {
      await response.body?.cancel();
      url = validateTarget(
        new URL(response.headers.get("Location")!, url).href,
        domain,
      );
      continue;
    }
    // Recheck DNS after connection; fail closed on a changed/private answer.
    await validateDns(url.hostname);
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (Number(response.headers.get("Content-Length") || 0) > 1_000_000) {
      await reader?.cancel();
      throw new HttpError(413, "Page exceeds 1 MB limit.");
    }
    if (reader)
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 1_000_000) {
          await reader.cancel();
          throw new HttpError(413, "Page exceeds 1 MB limit.");
        }
        chunks.push(part.value);
      }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return {
      url: url.href,
      statusCode: response.status,
      html: new TextDecoder().decode(bytes),
      contentType: response.headers.get("Content-Type") || "",
      chain,
      headers: response.headers,
    };
  }
  throw new HttpError(400, "Redirect chain exceeds five hops.");
}
export function analyzeHtml(
  html: string,
  url: string,
  statusCode = 200,
  xrobots = "",
) {
  const $ = load(html);
  const findings: Finding[] = [];
  const add = (
    checkType: string,
    severity: Finding["severity"],
    title: string,
    description: string,
    recommendation: string,
    evidence?: string,
  ) =>
    findings.push({
      checkType,
      severity,
      title,
      description,
      recommendation,
      evidence,
    });
  const title = $("title").first().text().trim();
  const description = $('meta[name="description" i]').attr("content")?.trim();
  const h1Tags = $("h1")
    .map((_, e) => $(e).text().trim())
    .get();
  const canonicalUrl = $('link[rel="canonical" i]').attr("href");
  const robots =
    ($('meta[name="robots" i]').attr("content") || "") + "," + xrobots;
  if (statusCode >= 400)
    add(
      "http_error",
      "error",
      `HTTP ${statusCode}`,
      "The server returned an error.",
      "Restore this page or update incoming links.",
      url,
    );
  if (!title)
    add(
      "missing_title",
      "error",
      "Missing title",
      "No title was found.",
      "Add a descriptive title.",
    );
  if ($("title").length > 1)
    add(
      "multiple_title",
      "warning",
      "Multiple titles",
      "More than one title element.",
      "Keep one title.",
    );
  if (title && (title.length < 30 || title.length > 60))
    add(
      "title_length",
      "notice",
      "Title length guideline",
      `Title has ${title.length} characters.`,
      "Review the title for clarity and search presentation.",
      title,
    );
  if (!description)
    add(
      "missing_description",
      "warning",
      "Missing meta description",
      "No description was found.",
      "Write a useful page description.",
    );
  if ($('meta[name="description" i]').length > 1)
    add(
      "multiple_description",
      "warning",
      "Multiple descriptions",
      "More than one description.",
      "Keep one description.",
    );
  if (!h1Tags.length)
    add(
      "missing_h1",
      "warning",
      "Missing H1",
      "No H1 heading was found.",
      "Add a descriptive primary heading.",
    );
  if (h1Tags.length > 1)
    add(
      "multiple_h1",
      "notice",
      "Multiple H1 headings",
      `${h1Tags.length} H1 headings.`,
      "Review the page heading structure.",
    );
  const images = $("img")
    .map((_, e) => ({
      src: $(e).attr("src") || "",
      alt: $(e).attr("alt"),
      hasAlt: $(e).attr("alt") !== undefined,
    }))
    .get();
  const missingAlt = images.filter((x) => !x.hasAlt);
  if (missingAlt.length)
    add(
      "missing_alt",
      "warning",
      "Images missing alt attributes",
      `${missingAlt.length} images have no alt attribute.`,
      "Describe meaningful images; use empty alt for decorative images.",
      missingAlt
        .map((i) => i.src)
        .slice(0, 5)
        .join(", "),
    );
  if (!canonicalUrl)
    add(
      "missing_canonical",
      "notice",
      "Missing canonical",
      "No canonical URL.",
      "Review whether a canonical link is appropriate.",
    );
  if (canonicalUrl) {
    try {
      const canonical = new URL(canonicalUrl, url);
      if (!["https:", "http:"].includes(canonical.protocol)) throw new Error();
      if (canonical.href !== url)
        add(
          "canonical_conflict",
          "notice",
          "Canonical points elsewhere",
          "This page canonicalizes to another URL.",
          "Confirm the canonical target is intentional.",
          canonical.href,
        );
    } catch {
      add(
        "invalid_canonical",
        "warning",
        "Invalid canonical",
        "Canonical cannot be parsed.",
        "Use a valid absolute HTTPS URL.",
        canonicalUrl,
      );
    }
  }
  if (/\bnoindex\b/i.test(robots))
    add(
      "noindex",
      "notice",
      "Noindex directive",
      "Search engines are told not to index this page.",
      "Confirm this is intentional.",
      robots,
    );
  if (/\bnofollow\b/i.test(robots))
    add(
      "nofollow",
      "notice",
      "Nofollow directive",
      "Links may not be followed.",
      "Review the robots directive.",
      robots,
    );
  const viewport = !!$('meta[name="viewport" i]').length;
  if (!viewport)
    add(
      "missing_viewport",
      "warning",
      "Missing viewport",
      "No mobile viewport tag.",
      "Add a viewport meta tag.",
    );
  const insecure = $('[src^="http:"]')
    .map((_, e) => $(e).attr("src"))
    .get();
  if (insecure.length)
    add(
      "insecure_resources",
      "warning",
      "Insecure resources",
      "HTTP resources on HTTPS page.",
      "Serve resources over HTTPS.",
      insecure.slice(0, 5).join(", "),
    );
  $('script[type="application/ld+json"]').each((_, e) => {
    try {
      JSON.parse($(e).text());
    } catch {
      add(
        "invalid_jsonld",
        "warning",
        "Invalid structured data JSON",
        "JSON-LD cannot be parsed.",
        "Fix JSON syntax.",
      );
    }
  });
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, e) => {
    try {
      const u = new URL($(e).attr("href")!, url);
      u.hash = "";
      if (!["http:", "https:"].includes(u.protocol)) return;
      (u.hostname === new URL(url).hostname
        ? internalLinks
        : externalLinks
      ).push(u.href);
    } catch {
      /* malformed links are ignored */
    }
  });
  $("script,style,noscript").remove();
  const wordCount = $('body').text().split(/\s+/).filter(Boolean).length;
  const blocked = statusCode === 401 || statusCode === 403 || /cdn-cgi\/challenge-platform|cf-chl-|<title[^>]*>\s*just a moment/i.test(html);
  const javascriptRequired = !blocked && statusCode < 400 && wordCount < 20 && !h1Tags.length && !internalLinks.length && /<script\b/i.test(html) && !!$('#root,#app,#__next,[data-reactroot]').length;
  const analysisStatus = blocked ? 'blocked' : statusCode>=400 ? 'http-error' : javascriptRequired ? 'javascript-required' : 'complete';
  const measuredFindings: Finding[] = blocked ? [{checkType:'crawler_blocked',severity:'warning',title:'Crawler access blocked',description:'The response is an access denial or bot challenge; page content could not be audited.',recommendation:'Review the site firewall and crawler access, then rerun. Do not treat challenge HTML as the page content.',evidence:`HTTP ${statusCode}`}]
    : javascriptRequired ? [{checkType:'javascript_required',severity:'warning',title:'Content may require JavaScript',description:'An application shell was returned with very little readable content. Content checks were skipped.',recommendation:'Serve important content in initial HTML or audit with a separately configured browser renderer. This does not prove Google cannot index the page.'}]
    : statusCode>=400 ? findings.filter(f=>f.checkType==='http_error') : findings;
  return {
    url,
    statusCode,
    title,
    description,
    h1Tags,
    canonicalUrl,
    noindex: /\bnoindex\b/i.test(robots),
    viewport,
    images,
    internalLinks: [...new Set(internalLinks)],
    externalLinks: [...new Set(externalLinks)],
    findings: measuredFindings,
    analysisStatus,
    wordCount,
    fetchedAt: new Date().toISOString(),
    https: true,
  };
}
export async function crawlPage(
  env: Env,
  url: string,
  domain: string,
  robotsText: string,
) {
  const rules = robotsParser(`https://${domain}/robots.txt`, robotsText);
  if (rules.isAllowed(url, env.CRAWLER_USER_AGENT || USER_AGENT) === false)
    throw new HttpError(403, "robots.txt disallows this URL.");
  await budget(
    env,
    "global",
    "crawl",
    Number(env.DAILY_CRAWL_PAGE_LIMIT || 100),
  );
  const page = await safeFetch(env, url, domain, value=>rules.isAllowed(value,env.CRAWLER_USER_AGENT || USER_AGENT)!==false);
  if(page.statusCode===429 || page.statusCode===503) {
    const seconds=Number(page.headers.get('Retry-After'));
    throw new HttpError(429,`Website temporarily rate limited the crawler (HTTP ${page.statusCode}). Retry after ${Number.isFinite(seconds)&&seconds>0?seconds+' seconds':'the server permits further requests'}.`);
  }
  if (page.statusCode < 400 && !page.contentType.includes("text/html"))
    throw new HttpError(415, "Target is not HTML.");
  const result = analyzeHtml(
    page.html,
    page.url,
    page.statusCode,
    page.headers.get("X-Robots-Tag") || "",
  );
  if (page.chain.length > 2)
    result.findings.push({
      checkType: "redirect_chain",
      severity: "warning",
      title: "Redirect chain",
      description: `${page.chain.length - 1} redirects.`,
      evidence: page.chain.join(" -> "),
      recommendation: "Link directly to the final destination.",
    });
  return { ...result, redirectChain: page.chain };
}
