import React, { useMemo } from "react";
import { useProject } from "../../context/ProjectContext";
import { countBy, weeklyVelocity } from "../../services/explorer";
import { display } from "../../services/measurements";
import { Donut, HBars, MirrorBars } from "./charts";
import { WidgetState } from "./ui";

const LINK_TYPES: Record<string, string> = { dofollow: "Follow", nofollow: "Nofollow", ugc: "UGC or sponsored", sponsored: "UGC or sponsored" };

/** Weekly link growth, follow vs nofollow, and the anchor texts other sites use, all from imported backlinks. */
export const BacklinkCharts: React.FC = () => {
  const { backlinks } = useProject();
  const model = useMemo(() => {
    const links = backlinks.map((b) => ({ sourceDomain: b.sourceDomain, firstSeen: b.firstSeen, lastSeen: b.lastSeen }));
    return {
      weeks: weeklyVelocity(links),
      types: countBy(backlinks, (b) => LINK_TYPES[b.linkType] ?? "Unknown"),
      anchors: countBy(backlinks, (b) => b.anchorText.trim().toLowerCase() || "(no anchor text)").slice(0, 8),
    };
  }, [backlinks]);

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
            <span>Weekly, last {model.weeks.length} weeks of the import</span>
          </span>
        </header>
        {model.weeks.length ? <MirrorBars weeks={model.weeks} /> : (
          <WidgetState kind="empty" title="Imported links have no dates" body="Weekly growth needs first-seen and last-seen dates in the CSV." />
        )}
      </section>

      <section className="card span-6" aria-labelledby="link-types-title">
        <header className="card-head">
          <h2 id="link-types-title">Link types</h2>
          <span className="card-meta">{backlinks.length.toLocaleString()} links</span>
        </header>
        <Donut label="Type" unit="links" parts={model.types.slice(0, 4)} />
      </section>

      <section className="card span-6" aria-labelledby="anchors-title">
        <header className="card-head">
          <h2 id="anchors-title">Top anchor texts</h2>
          <span className="card-meta">By number of links</span>
        </header>
        <HBars unit="links" rows={model.anchors.map((a) => ({ name: a.name, value: a.value, note: `${display(a.share)}%` }))} />
      </section>
    </div>
  );
};
