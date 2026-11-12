export interface Env {
  NVIDIA_API_KEY?: string;
  NVIDIA_AI_PRODUCTION_ENABLED?: string;
  MANUAL_ADMIN_USERNAME?: string;
  MANUAL_ADMIN_PASSWORD_HASH?: string;
  DB: D1Database;
  ASSETS: Fetcher;
  APP_BASE_URL: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_ENCRYPTION_KEY: string;
  ALLOWED_EMAIL_DOMAIN?: string;
  GOOGLE_PAGESPEED_API_KEY?: string;
  CRAWLER_MAX_PAGES?: string;
  CRAWLER_MAX_DEPTH?: string;
  CRAWLER_REQUEST_TIMEOUT_MS?: string;
  DAILY_CRAWL_PAGE_LIMIT?: string;
  DAILY_PAGESPEED_REQUEST_LIMIT?: string;
  DAILY_GSC_REQUEST_LIMIT?: string;
  OPEN_PAGERANK_ADAPTER_URL?: string;
  OPEN_PAGERANK_ADAPTER_TOKEN?: string;
  DAILY_OPEN_PAGERANK_REQUEST_LIMIT?: string;
  DATA_RETENTION_DAYS?: string;
  CRAWLER_USER_AGENT?: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function stmt(env: Env, sql: string, ...args: unknown[]) {
  return env.DB.prepare(sql).bind(
    ...args.map((v) => (v === undefined ? null : v)),
  );
}
export async function rows<T>(
  env: Env,
  sql: string,
  ...args: unknown[]
): Promise<T[]> {
  return (await stmt(env, sql, ...args).all<T>()).results;
}
export async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("Content-Length") || 0) > 2_000_000)
    throw new HttpError(413, "Request exceeds 2 MB limit.");
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  if (reader)
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new HttpError(413, "Request exceeds 2 MB limit.");
      }
      text += decoder.decode(part.value, { stream: true });
    }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function budget(
  env: Env,
  scope: string,
  service: string,
  limit: number,
) {
  const date = now().slice(0, 10);
  const result = await stmt(
    env,
    `INSERT INTO usage_budgets(scope,service,date,used) VALUES(?,?,?,1)
    ON CONFLICT(scope,service,date) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used`,
    scope,
    service,
    date,
    limit,
  ).first();
  if (!result)
    throw new HttpError(
      429,
      `Daily ${service} budget reached; work saved. Retry after midnight UTC.`,
    );
}
export async function external(
  url: string,
  init: RequestInit = {},
  timeout = 15000,
) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      `External service returned HTTP ${response.status}.`,
    );
  return response;
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function objects<T>(
  env: Env,
  table: string,
  projectId: string,
  limit = 5000,
): Promise<T[]> {
  // Table names are internal constants, never request input.
  return (
    await rows<{ data: string }>(
      env,
      `SELECT data FROM ${table} WHERE project_id=? ORDER BY created_at DESC LIMIT ?`,
      projectId,
      limit,
    )
  ).map((r) => JSON.parse(r.data) as T);
}
