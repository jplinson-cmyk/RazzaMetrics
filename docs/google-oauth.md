# Google account and Search Console setup

1. Create a Google Cloud project and enable the Search Console API. Enable PageSpeed Insights if using a key for that optional integration.
2. Configure the Google OAuth consent screen. For testing, add the intended accounts as test users. Add `openid`, `email`, `profile` and `https://www.googleapis.com/auth/webmasters.readonly`. Follow Google's consent verification/publishing requirements for the chosen audience.
3. Create OAuth credentials for a **Web application**, with an exact redirect URI matching GOOGLE_REDIRECT_URI: local http://localhost:8787/api/auth/callback or production https://your-host/api/auth/callback.
4. Set the client ID and client secret on the server. Never expose the secret in frontend code.
5. Sign in from the application. It uses authorization code flow, PKCE S256, a 10-minute state record and an HttpOnly SameSite state cookie. Callbacks consume state once. The server checks Google's verified email and the configured allowed domain.
6. Credentials are encrypted with AES-256-GCM in D1. Only a random session cookie is returned to the browser; session identifiers are hashed in D1. Refresh happens server-side before token expiry.
7. Add the website project, open GSC, and choose a property from the returned list. The server rechecks Google property permission and website matching. A domain property's scope may include subdomains; URL-prefix properties must match the project hostname.
8. Saving a property queues a 90-day daily backfill ending three days ago. Google data can be delayed, anonymized or incomplete; omitted rows are never replaced with invented values. Manual and daily incremental synchronization overlap seven days and upsert on the complete dimension tuple.
9. To disconnect, use GSC -> Disconnect account. This revokes Google's token, deletes stored credentials, clears this account's project property selections and cancels active GSC jobs. If revocation is unavailable, the app reports failure rather than falsely claiming revocation.

**Live verification required:** complete consent in a real authorized account, select a property, observe completed daily job batches and matching Search Console records, force access-token expiry in a staging DB and verify refresh, then disconnect and verify Google's revocation. Automated tests use mocked Google responses.

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).
