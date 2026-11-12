# Razza Metrics

## What it is
An internal SEO analytics and site explorer for Razza Consulting. Consultants open it to read one client domain at a time: how much organic search traffic it earns, which keywords and pages earn it, what its backlink profile looks like, and what the technical audit found.

## Who uses it
Razza Consulting SEO leads, strategists, content specialists and technical auditors. They know Ahrefs Site Explorer and Semrush Domain Overview and expect the same reading order: a domain, a period, a strip of headline metrics, a trend, then breakdowns.

## Surfaces
- **Overview** (Operate): KPI strip, organic traffic trend against keyword footprint, keyword position distribution, top pages and backlink velocity.
- **Organic Keywords, Top Pages, Backlink Profile, Site Audit** (Operate): searchable, sortable tables with summary metrics.
- **More tools**: rank tracking, backlink toxicity review and the issue tracker.

## Data truth
Every figure comes from data the project stores: Google Search Console measurements (clicks, impressions, average position by query, page, date, device and country), imported backlink CSVs, and the server-side HTML audit. Nothing is estimated. Where a metric has no source (domain authority, traffic value), the UI says so instead of showing a number.

## Constraints
- Light canvas by default with a dark mode; brand colours from the Razza identity, swappable from one token file.
- WCAG AA contrast at minimum; 14px floor on table cells, tabs and navigation labels.
- Existing routes, handlers and test hooks stay stable.
