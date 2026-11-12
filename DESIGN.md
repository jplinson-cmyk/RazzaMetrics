# Razza Metrics: design system

The Razza Consulting palette on Furrow's structure: white cards on a near-white canvas, ink rules over lists, a Header Charcoal sidebar, and Lime Chartreuse as the one brand signal. Slate Blue carries the second data series.

All values live in [`src/tokens.css`](src/tokens.css), with the seven brand colours declared once as `--brand-*`. Change one there and the whole app follows. `.dark` redefines the same names for the theme switch.

## Brand palette

| Name | Hex | Token |
| --- | --- | --- |
| Lime Chartreuse (primary) | `#A3CA39` | `--brand-lime` |
| Soft Lime (logo highlight) | `#C2DF71` | `--brand-lime-soft` |
| Leaf Green (logo midtone) | `#99BE3A` | `--brand-leaf` |
| Header Charcoal | `#2F2F2F` | `--brand-charcoal` |
| Onyx Charcoal | `#262626` | `--brand-onyx` |
| Pure White | `#FFFFFF` | `--brand-white` |
| Slate Blue (hero overlay) | `#486D7F` | `--brand-slate` |

## The one rule for lime

Lime on white measures **1.9:1**, too faint for any text or thin line. So:

- **Lime is a fill with charcoal on it** (8:1): the selected nav item, selected filter pills, primary buttons, share bars, the brand mark.
- **On charcoal, lime is a mark or text** (7:1): sidebar accents, the sign-in panel's icons.
- **On white, a lime-family line or text uses deep leaf `#5B7A1A`** (`--color-accent`, 5:1). That covers the Organic Traffic line, focus rings, underlines on selected tabs and sparklines. It's derived from Leaf Green, not a new brand colour.

Leaf Green (`#99BE3A`) is the hover state of lime fills. Soft Lime is the hover state in dark mode and lime text on charcoal.

## Roles

| Token | Light value | Use |
| --- | --- | --- |
| `--color-paper` | near-white, faint lime cast | App canvas, top bar |
| `--color-paper-2` | Pure White | Cards, tables, controls |
| `--color-ink` / `--color-ink-2` | Onyx / Header Charcoal | Text, figures, ink rules |
| `--color-muted` | `oklch(45% …)` | Labels and column heads (6.9:1) |
| `--color-accent-fill` | Lime Chartreuse | Fills under charcoal text |
| `--color-accent` | deep leaf `#5B7A1A` | Lines, rings and marks on white |
| `--color-accent-2` | Slate Blue | Keyword Footprint series (dashed), instrument readings (5.6:1 on white) |
| `--color-ok` | emerald | Gains, Top 3. Kept apart from the brand lime so "good" never reads as "selected" |
| `--color-bad` | coral red | Losses, lost domains, errors |
| `--color-warn` | amber | Warnings |
| `--pos-1` … `--pos-5` | emerald, lime, slate, two slate tints | Position distribution: Top 3, 4–10, 11–20, 21–50, 51–100 |

**Charcoal surfaces:** the sidebar is Header Charcoal in both modes, set by scoped tokens on `.app-sidebar`. The sign-in story panel is Onyx. Dark mode uses Onyx for the canvas and Header Charcoal for cards.

## Type

Red Hat Display 600 for titles and big figures, Red Hat Text for everything else (14px minimum in tables, tabs and nav), and Red Hat Mono only for URLs, dates and counts. Sentence case, never tracked.

## Surfaces and controls

- The KPI strip is a notebook card: 14px corners, an ink ring, cells on an 8px grid parted by ink lines. It is the only element that lifts.
- Cards are white, 10px corners, hairline edges, no shadow. Tables and lists sit under a 1px ink rule with 48px rows.
- Buttons are 6px moulded keys: white with a lit top edge, or lime with onyx text for the primary. Pressing sinks a key 1px.
- Badges are 4px tags: emerald gains, coral losses, sign first.

## States and motion

Skeletons keep the loaded geometry. A filter change dims the figures to 60% with "Updating analytics…" and a progress line. Every widget has empty and error states with Retry. Motion is 120–200ms on state changes only, and still under reduced motion.
