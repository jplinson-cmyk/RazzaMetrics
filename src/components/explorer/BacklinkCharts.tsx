import React, { useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { countBy, weeklyVelocity } from "../../services/explorer";
import { display } from "../../services/measurements";
import { Donut, HBars, MirrorBars } from "./charts";
import { WidgetState } from "./ui";
import { MonthFilter, monthsIn } from "./MonthFilter";

const LINK_TYPES: Record<string, string> = { dofollow: "Follow", nofollow: "Nofollow", ugc: "UGC or sponsored", sponsored: "UGC or sponsored" };

/** Weekly link growth, follow vs nofollow, and the anchor texts other sites use, all from imported backlinks. */
export const BacklinkCharts: React.FC = () => {
  const { backlinks } = useProject();
  // Each chart has its own month; types and anchors use links first seen in that month.
  const [weekMonth, setWeekMonth] = useState("");
  const [typeMonth, setTypeMonth] = useState("");
  const [anchorMonth, setAnchorMonth] = useState("");
  const allWeeks = useMemo(
    () => weeklyVelocity(backlinks.map((b) => ({ sourceDomain: b.sourceDomain, firstSeen: b.firstSeen, lastSeen: b.lastSeen })), 52),
    [backlinks],
  );
  const linkMonths = useMemo(() => monthsIn(backlinks.map((b) => b.firstSeen)), [backlinks]);
  const seenIn = (month: string) => (month ? backlinks.filter((b) => b.firstSeen?.startsWith(month)) : backlinks);
  const typeLinks = seenIn(typeMonth);
  const anchorLinks = seenIn(anchorMonth);
  const model = {
    // Without a month: the last 12 weeks. With one: the weeks ending in that month.
    weeks: weekMonth ? allWeeks.filter((w) => w.to.startsWith(weekMonth)) : allWeeks.slice(-12),
    types: countBy(typeLinks, (b) => LINK_TYPES[b.linkType] ?? "Unknown"),
    anchors: countBy(anchorLinks, (b) => b.anchorText.trim().toLowerCase() || "(no anchor text)").slice(0, 8),
  };
  const noLinks = <WidgetState kind="empty" title="No links first seen in this month" body="Pick another month or All dates." />;

  if (!backlinks.length) {
    return (
      <section className="card">
        <WidgetState kind="empty" title="No backlinks imported yet" body="Import a backlink CSV below to see link growth, link types and anchor texts." />
      </section>
    );
  }
  const gained = model.weeks.reduce((n, w) => n + w.gained, 0);
  const lost = model.weeks.reduce((n, w) => n + w.lost, 0);

  return (
    <div className="explorer">
      <section className="card span-12" aria-labelledby="link-weeks-title">
        <header className="card-head">
          <h2 id="link-weeks-title">Referring domains gained and lost</h2>
          <span className="card-meta legend-static">
            <span><span className="swatch swatch--up" aria-hidden="true" /> {gained} new</span>
            <span><span className="swatch swatch--down" aria-hidden="true" /> {lost} lost</span>
            <span>{weekMonth ? "Weekly" : `Weekly, last ${model.weeks.length} weeks of the import`}</span>
          </span>
          <MonthFilter value={weekMonth} onChange={setWeekMonth} months={monthsIn(allWeeks.map((w) => w.to))} allLabel="Last 12 weeks" />
        </header>
        {model.weeks.length ? <MirrorBars weeks={model.weeks} /> : (
          <WidgetState kind="empty" title="Imported links have no dates" body="Weekly growth needs first-seen and last-seen dates in the CSV." />
        )}
      </section>

      <section className="card span-6" aria-labelledby="link-types-title">
        <header className="card-head">
          <h2 id="link-types-title">Link types</h2>
          <span className="card-meta">{typeLinks.length.toLocaleString()} links</span>
          <MonthFilter value={typeMonth} onChange={setTypeMonth} months={linkMonths} allLabel="All dates" />
        </header>
        {typeLinks.length ? <Donut label="Type" unit="links" parts={model.types.slice(0, 4)} /> : noLinks}
      </section>

      <section className="card span-6" aria-labelledby="anchors-title">
        <header className="card-head">
          <h2 id="anchors-title">Top anchor texts</h2>
          <span className="card-meta">By number of links</span>
          <MonthFilter value={anchorMonth} onChange={setAnchorMonth} months={linkMonths} allLabel="All dates" />
        </header>
        {anchorLinks.length ? <HBars unit="links" rows={model.anchors.map((a) => ({ name: a.name, value: a.value, note: `${display(a.share)}%` }))} /> : noLinks}
      </section>
    </div>
  );
};
