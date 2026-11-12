# Repository assessment and implementation map

## Inspected baseline

The supplied workspace is a React 18 / Vite 5 SPA, TypeScript strict mode, Tailwind 3.4 (JavaScript configuration). It is not the TanStack Start OpenSEO fork described in the brief. There is no Git metadata, server, session backend, SQL migration, Wrangler configuration, license file, or TanStack router in this checkout. Existing component layouts, Inter/Poppins typography, cards, tables, dark mode, and responsive navigation are the UI foundation.

The six tools already exist under `src/components/tools`. `App.tsx` switches views in memory. `ProjectContext.tsx` previously seeded mock data and generated domain measurements. `AuthContext.tsx` previously trusted localStorage and shipped admin123. `domainIntelligence.ts` contains fabricated domain profiles. Dexie repositories existed but were inconsistently wired to components. Google used browser access tokens; the crawler was constrained by browser CORS. The baseline production build fails because reloadBacklinks is absent from ProjectContext.

Dependency inspection found no DataForSEO, OpenRouter, paid SERP, billing or EveryApp SDK in package.json. Cheerio, PapaParse, Dexie and React are present. Existing browser records are not deleted or silently promoted into trusted server measurements.

## Database and directory changes

`migrations/0001_platform.sql` adds a D1 schema: users -> sessions and Google connections; users -> projects -> keywords, performance, backlink import batches/observations, assessments/snapshots, audit runs/pages/findings, PageSpeed measurements, issues/comments/events, jobs and integration logs. Foreign keys cascade only within their owning project. Composite uniqueness prevents measurement collisions. Quota counters are persistent and atomic.

`server/` adds Worker request handling, session/OAuth security, authorized D1 access, jobs, Google integration and crawler services. `src/services/api.ts` provides same-origin requests. Existing context APIs adapt server records to the current component shapes. Existing six-tool components remain in place; no new dashboard template is introduced. `wrangler.jsonc`, `.env.example`, `tests/` and `docs/` supply runtime configuration, verification and setup.

## Functional integration mapping

Project selector/forms -> authorized project API -> D1 projects. Login -> server authorization-code OAuth -> HttpOnly session. GSC connection/property picker -> server credential store -> Google property verification. Ranking and organic views -> persisted daily Search Analytics rows; tracked keywords are independent records. CSV import -> normalized observations without invented relationships. Toxicity -> explainable heuristic assessments and snapshots. Audit -> persistent leased crawl jobs -> actual HTML findings -> issue reconciliation. PageSpeed -> bounded jobs -> cached real lab/field results. Issue actions -> authorized mutations plus event history. Exports -> current measured/filtered rows.

## Compatibility and technical risks

There is no existing TanStack architecture to retain. Migrating frameworks would be a separate architectural change and is not silently performed. D1/Workers and live Google access require deployment configuration. Free subscriptions do not imply unlimited infrastructure. GSC omits anonymized queries and may return only top rows. Static HTML cannot fully audit JavaScript rendering. The crawler must refuse unsafe targets and redirects, obey robots, bound bytes/pages/depth, and fail closed when DNS validation is unavailable. Open PageRank is optional and must remain disabled without a compliant egress adapter. No live integration can be certified from mocks alone.
