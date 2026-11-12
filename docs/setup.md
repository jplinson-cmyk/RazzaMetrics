# Local setup

1. Use Node 22.12 or later. Run `npm install`.
2. Copy `.env.example` to `.dev.vars`. Both `.env` and `.dev.vars` are ignored. No secret uses a `VITE_` prefix.
3. Generate an encryption key with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Save it as APP_ENCRYPTION_KEY. Keep a secure backup; replacing it prevents decrypting existing Google credentials.
4. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and APP_BASE_URL. Local values: http://localhost:8787 and http://localhost:8787/api/auth/callback. ALLOWED_EMAIL_DOMAIN defaults to razzaconsulting.com; set an appropriate explicit allowlist domain before deployment.
5. Run `npm run db:migrate` (local D1 only), then `npm run build`, then `npm run dev:server`.
6. Open http://localhost:8787. Sign in, add a project using its exact HTTPS hostname, select a verified Search Console property from GSC, and save it. Initial synchronization is queued automatically.
7. For frontend hot reload, run `npm run dev` separately. Use localhost:8787 for OAuth; Vite on port 3000 proxies API requests, but mutation origin checks intentionally require the configured application origin. Use the Worker origin for workflow verification.
8. Import a GSC CSV from Backlink Audit, recalculate risk, and run a manual audit. Results and jobs persist in D1 across refresh and Worker restarts.

The supplied browser-only localStorage and IndexedDB records are left untouched on the device. They are not silently imported as trusted production measurements because the previous code generated simulated values. Reimport source CSVs and sync authorized Google data instead.

All ordinary API operations require a server session and project ownership. Manual login is optional and verified on the server using MANUAL_ADMIN_USERNAME (default `admin`) and MANUAL_ADMIN_PASSWORD_HASH. The password itself is not stored in the browser or configuration; only its salted PBKDF2-SHA256 hash is saved in ignored `.dev.vars`. There is no automatic login or localStorage identity. Production manual login is disabled until its password hash is explicitly configured as a Worker secret.

To set a different manual password, generate a hash with `node -e "const c=require('crypto'),s=c.randomBytes(16);console.log(s.toString('hex')+':'+c.pbkdf2Sync(process.env.ADMIN_PASSWORD,s,100000,32,'sha256').toString('hex'))"` using ADMIN_PASSWORD in the process environment, then update MANUAL_ADMIN_PASSWORD_HASH locally or through `wrangler secret put`. Manual attempts are limited to 20 per source IP per UTC hour. Sessions persist for seven days and logout revokes them. A manual admin can connect Google from an owned project's GSC settings; project ownership stays with the manual account.
