# OpenSEO source comparison

Compared against https://github.com/every-app/open-seo at commit `99d9a49c8cb742d54eddd64d09efbc5302f6db89`. Reference checkout is isolated in ignored `.tmp/open-seo-reference`; it is not part of the app build. Upstream MIT notice is preserved in UPSTREAM-LICENSE.txt.

| Area | Upstream implementation inspected | Razza decision |
| --- | --- | --- |
| Architecture | TanStack Start, React 19, Tailwind 4, Drizzle and auxiliary audit Worker | Preserve supplied React 18/Vite/Tailwind 3 interface and existing D1 API; copying upstream configuration would break this workspace |
| Rank tracking | `src/server/features/rank-tracking/services/RankTrackingService.ts` uses DataForSEO and scheduled SERP checks | Retain free GSC average-position measurements; do not claim live SERP parity |
| Backlinks | `src/server/features/backlinks/services/BacklinksService.ts` uses DataForSEO-backed cached datasets | Retain real imported observations and optional authority adapter; no fabricated backlink discovery |
| GSC | `src/server/features/gsc/searchAnalytics.ts` validates dimensions, bounded pagination and delayed dates | Existing daily GSC store and complete dimension tuple retained; live verification needs Google credentials |
| Audit discovery | `src/server/lib/audit/discovery.ts` handles sitemap indexes, limits and redirect validation | Added bounded index traversal, multiple robots sitemap declarations, deduplication and saved one-document discovery batches |
| Incomplete page analysis | `src/shared/audit-issues.ts` distinguishes blocked responses and JavaScript shells | Added explicit coverage statuses; suppress misleading missing-content findings and prevent these responses resolving existing issues |
| Crawl policy | Redirect destinations must respect crawl policy | Added robots checks on each page redirect destination; robots exclusions are saved as skipped observations |
| Rate limits | Upstream distinguishes site throttling from successful audits | 429/503 page responses defer jobs rather than generate content findings |

Changes are independent adaptations to this application's service interfaces. Upstream paid provider calls, billing, AI modules, MCP endpoints and renderer infrastructure were not copied. This is functional alignment within the selected free-data scope, not full upstream feature parity. JavaScript rendering, full external-link probes and production provider verification remain separate gaps.
