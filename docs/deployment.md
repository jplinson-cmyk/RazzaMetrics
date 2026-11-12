# Cloudflare deployment

Live instance: https://razza-metrics.razza-seo-platform.workers.dev (Worker `razza-metrics`, D1 database `razza-seo`, Workers Free plan).

1. Authenticate Wrangler (`npx wrangler login`) using your own Cloudflare account.
2. Create D1: `npx wrangler d1 create razza-seo`. Put the returned ID in the `env.production` block of `wrangler.jsonc` (the top-level block stays the local development database). Do not point tests at production.
3. Back up any existing deployment data before applying migrations. This checkout's new migrations create independent server tables and do not delete browser records. For a preexisting server DB with conflicting table names, reconcile its schema first; do not force-apply a replacement schema.
4. Apply production migrations: `npx wrangler d1 migrations apply razza-seo --remote --env production`.
5. Set APP_BASE_URL and GOOGLE_REDIRECT_URI in the `env.production` vars to the final HTTPS origin and exact callback URL. Configure ALLOWED_EMAIL_DOMAIN explicitly.
6. Set secrets with `npx wrangler secret put <NAME> --env production` for GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_ENCRYPTION_KEY (and MANUAL_ADMIN_USERNAME / MANUAL_ADMIN_PASSWORD_HASH for username login). Optionally set GOOGLE_PAGESPEED_API_KEY. Secrets must never be committed.
7. Run type checks, lint, tests and `npm run build`. Run `npx wrangler deploy --dry-run --outdir .tmp/worker-build` to validate packaging. Deploy only after reviewing the configured account, database and domain: `npm run deploy` (builds, then runs `wrangler deploy --env production`).
8. The Worker serves built Vite assets and handles `/api/*` before SPA fallback. Server files are excluded from the browser build.
9. The cron runs every minute. It enqueues stale active GSC projects and processes one leased batch per invocation. Jobs also advance while an authenticated project screen polls. One active job is leased globally to limit concurrency; per-project active keys deduplicate requests. Interrupted leases expire after two minutes; repeated interruption or failures stop after four attempts. Rate-limit failures defer to the next UTC day without consuming the failure allowance.
10. Verify real OAuth, GSC, manual crawl, PageSpeed and cron behavior in deployment. Check D1/Workers usage in Cloudflare. Infrastructure quotas and API budgets are separate; the app never upgrades a plan.

## Budgets and retention

Defaults: 100 GSC calls/day, 100 fetched crawl pages/day, 10 PageSpeed calls/day; 25 pages/crawl, depth 3, 1 MB/page, 1 MB/CSV, 500 CSV rows/batch, 5,000 normalized backlinks/project, 10,000 performance rows/display query. Retention defaults to 400 days (30–3650 configurable). Cron purges old performance rows, terminal jobs and integration logs in bounded batches. Other saved evidence remains until project deletion; monitor database storage and export/archive projects as needed.

PageSpeed requests have a 60-second timeout (mobile Lighthouse runs regularly take 20–40 s); PageSpeed runs from the cron, whose runs may last minutes, while open screens process crawl and sync batches in the background. Slow tests can fail and retry; they do not become fake scores. Crawls fetch one page per batch, use manual redirects and require public DNS answers. DNS checks reduce rebinding exposure but Fetch cannot pin the checked address. For hostile or independently controlled target DNS, use a network-isolated fetch adapter before exposing the crawler to untrusted tenants.

## Optional authority adapter

Direct Open PageRank calls are disabled. To use enrichment, supply a compliant fixed-egress HTTPS service through OPEN_PAGERANK_ADAPTER_URL and an optional OPEN_PAGERANK_ADAPTER_TOKEN. The adapter holds the provider key and satisfies provider IP restrictions. Contract: `POST {"domains":["example.com"]}` -> `{"results":[{"domain":"example.com","score":5.2}]}`. Scores must be actual Open PageRank values 0–10. The Worker caches them for 30 days, limits daily requests, and enriches at most 100 missing domains per calculation. Repeated recalculations can fill additional domains. Adapter failures are logged and leave attributes unknown. Provisioning and live verification of this external adapter remain your deployment responsibility.

Reference: [D1 limits and batch semantics](https://developers.cloudflare.com/d1/platform/limits/).
