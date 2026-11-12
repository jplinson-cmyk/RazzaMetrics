# Troubleshooting

- **Setup screen:** configure `.dev.vars` locally or Wrangler secrets remotely; build and serve through the Worker, not a static-only host.
- **Origin validation failed:** APP_BASE_URL must exactly match the browser origin. Do not perform mutations from the Vite hot-reload origin unless you intentionally reconfigure the app for it.
- **OAuth state failure:** restart sign-in in the same browser. State is single-use and expires in ten minutes. Confirm cookies are enabled and redirect host/protocol match.
- **Google refresh failure:** reconnect via GSC. Confirm consent includes Search Console read permission and offline access. Testing-mode Google refresh tokens can expire according to Google's policy.
- **Property rejected:** being a domain owner is insufficient; this Google account needs the selected Search Console property permission. The property must match the project hostname.
- **No Data:** connect and save a property, queue sync, wait for job batches, and select dates with impressions. Recently collected data may be delayed by Google. Imported backlinks are separate from GSC query measurements.
- **Queued jobs:** inspect saved jobs for quota messages. Normal work advances in cron or while the project screen polls. One lease runs at once. A failed terminal job can be retried by invoking the same tool action; a new job is deduplicated only while prior work is active.
- **Crawler rejects website:** use the exact HTTPS project hostname, avoid apex/www redirects across hostnames, and ensure all DNS answers are public. DNS/robots failures fail closed. To audit www, create a project for www.
- **Aggregate import:** target-only and anchor-only reports are stored as aggregate snapshots. Use source-domain or latest/sample-links exports for individual observation analysis. Unknown source-to-target mappings cannot be reconstructed.
- **Authority unavailable:** optional enrichment needs a compliant HTTPS fixed-egress adapter, not a free provider key sent directly from the Worker. See deployment.md.
- **C: drive full:** this workspace uses `.npm-cache` and `.tmp` on D:. Free disk space through your own normal maintenance if other applications fail; the setup does not delete personal files.
- **Test browser not found:** update the executablePath in playwright.config.ts. E2E data resides only in `.wrangler/e2e`. Never run its seed script against a production database.
