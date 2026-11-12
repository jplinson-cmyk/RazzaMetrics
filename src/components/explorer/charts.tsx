import React from "react";
import { display } from "../../services/measurements";
import { abbreviate } from "../../services/explorer";
import { Truncate } from "./ui";

/**
 * Smooth path through points with monotone cubic curves (Fritsch–Carlson): the curve never
 * overshoots between two points, so a line never dips below zero or above a real peak.
 */
export function curve(pts: [number, number][]): string {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const n = pts.length;
  const d = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0] || 1));
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let path = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3;
    path += ` C${(x0 + h).toFixed(1)} ${(y0 + m[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)} ${(y1 - m[i + 1] * h).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return path;
}

/** Vertical fade under a line, coloured by the series' CSS `color`. */
export function AreaGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** Donut for a share of at most four parts; the legend table carries the exact numbers. */
export function Donut({ parts, unit, label }: { parts: { name: string; value: number; share: number }[]; unit: string; label: string }) {
  const r = 54, c = 2 * Math.PI * r;
  let offset = 0;
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" className="donut-svg" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${display(p.share)}%`).join(", ")}`}>
        <circle cx="70" cy="70" r={r} className="donut-track" />
        {parts.map((p, i) => {
          const len = (p.share / 100) * c;
          const seg = (
            <circle key={p.name} cx="70" cy="70" r={r} className={`donut-seg series-${i + 1}`}
              strokeDasharray={`${Math.max(0, len - (parts.length > 1 ? 3 : 0))} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return seg;
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-total">{abbreviate(total)}</text>
        <text x="70" y="88" textAnchor="middle" className="donut-unit">{unit}</text>
      </svg>
      <table className="dist-table">
        <thead><tr><th scope="col">{label}</th><th scope="col" className="num">{unit[0].toUpperCase() + unit.slice(1)}</th><th scope="col" className="num">Share</th></tr></thead>
        <tbody>
          {parts.map((p, i) => (
            <tr key={p.name}>
              <th scope="row"><span className={`swatch series-bg-${i + 1}`} aria-hidden="true" /> {p.name}</th>
              <td className="num">{p.value.toLocaleString()}</td>
              <td className="num">{display(p.share)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Labelled horizontal bars, scaled to the largest value. */
export function HBars({ rows, unit }: { rows: { name: string; value: number; note?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.name}>
          <span className="hbar-name"><Truncate text={r.name} /></span>
          <span className="hbar-track" aria-hidden="true"><span className="hbar-fill" style={{ transform: `scaleX(${r.value / max})` }} /></span>
          <span className="hbar-value num">{r.value.toLocaleString()} <span className="visually-hidden">{unit}</span>{r.note && <span className="hbar-note">{r.note}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

/** Keywords that moved: gains to the right in green, drops to the left in coral, from one centre line. */
export function Diverging({ rows }: { rows: { keyword: string; change: number; position: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.change)));
  return (
    <ul className="diverging">
      {rows.map((r) => {
        const up = r.change > 0;
        return (
          <li key={r.keyword}>
            <span className="div-name"><Truncate text={r.keyword} /></span>
            <span className="div-axis" aria-hidden="true">
              <span className="div-half div-half--down">{!up && <span className="div-bar div-bar--down" style={{ transform: `scaleX(${Math.abs(r.change) / max})` }} />}</span>
              <span className="div-half div-half--up">{up && <span className="div-bar div-bar--up" style={{ transform: `scaleX(${r.change / max})` }} />}</span>
            </span>
            <span className={`div-value num ${up ? "is-up" : "is-down"}`}>
              {up ? "+" : "−"}{display(Math.abs(r.change))}
              <span className="visually-hidden"> positions, now {display(r.position)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface ScatterPoint { keyword: string; position: number; ctr: number; impressions: number; clicks: number; opportunity: boolean }

/** CTR against average position. Position runs on a log scale so page one gets the room it deserves. */
export function CtrScatter({ points }: { points: ScatterPoint[] }) {
  const W = 680, H = 290, L = 48, R = 16, T = 12, B = 44;
  const pw = W - L - R, ph = H - T - B;
  const maxCtr = Math.max(5, Math.ceil(Math.max(...points.map((p) => p.ctr)) / 5) * 5);
  const x = (pos: number) => L + (Math.log10(Math.min(100, Math.max(1, pos))) / 2) * pw;
  const y = (ctr: number) => T + ph - (Math.min(ctr, maxCtr) / maxCtr) * ph;
  const maxImp = Math.max(1, ...points.map((p) => p.impressions));
  const radius = (imp: number) => 3 + Math.sqrt(imp / maxImp) * 8;
  // Draw small dots last so they stay clickable above large ones.
  const ordered = [...points].sort((a, b) => b.impressions - a.impressions);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="scatter-svg" role="img" aria-label={`Click-through rate against average position for ${points.length} keywords; ${points.filter((p) => p.opportunity).length} flagged as low click-through.`}>
      {[0, maxCtr / 2, maxCtr].map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="tick" x={L - 8} y={y(t) + 4} textAnchor="end">{display(t)}%</text>
        </g>
      ))}
      {[1, 3, 10, 20, 50, 100].map((p) => (
        <text key={p} className="tick" x={x(p)} y={T + ph + 18} textAnchor="middle">{p}</text>
      ))}
      <line className="scatter-page1" x1={x(10.5)} x2={x(10.5)} y1={T} y2={T + ph} />
      <text className="tick" x={x(10.5) + 6} y={T + 12}>page 1 ends</text>
      <text className="tick" x={L + pw / 2} y={H - 2} textAnchor="middle">Average position</text>
      {ordered.map((p) => (
        <circle key={p.keyword} cx={x(p.position)} cy={y(p.ctr)} r={radius(p.impressions)} className={p.opportunity ? "dot-opportunity" : "dot-normal"}>
          <title>{`${p.keyword}: position ${display(p.position)}, CTR ${display(p.ctr)}%, ${p.impressions.toLocaleString()} impressions`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Bar from a baseline at y0, `h` px tall (negative grows upward), rounded only at its free end. */
function bar(x: number, y0: number, w: number, h: number) {
  const r = Math.min(5, w / 2, Math.abs(h)), s = Math.sign(h) || 1, y1 = y0 + h;
  return `M${x} ${y0} V${y1 - s * r} Q${x} ${y1} ${x + r} ${y1} H${x + w - r} Q${x + w} ${y1} ${x + w} ${y1 - s * r} V${y0} Z`;
}

/** Weekly bars mirrored on one baseline: gains above in green, losses below in coral. */
export function MirrorBars({ weeks }: { weeks: { from: string; to: string; gained: number; lost: number }[] }) {
  const W = 680, H = 220, L = 36, R = 8, T = 10, B = 26;
  const max = Math.max(1, ...weeks.flatMap((w) => [w.gained, w.lost]));
  const mid = T + (H - T - B) / 2, half = (H - T - B) / 2;
  const slot = (W - L - R) / weeks.length, bw = Math.min(16, slot * 0.45);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bars-svg" role="img"
      aria-label={`Referring domains gained and lost per week: ${weeks.reduce((n, w) => n + w.gained, 0)} gained, ${weeks.reduce((n, w) => n + w.lost, 0)} lost over ${weeks.length} weeks.`}>
      <text className="tick" x={L - 6} y={T + 10} textAnchor="end">+{max}</text>
      <text className="tick" x={L - 6} y={H - B} textAnchor="end">−{max}</text>
      <line className="baseline" x1={L} x2={W - R} y1={mid} y2={mid} />
      {weeks.map((w, i) => {
        const cx = L + slot * i + slot / 2;
        return (
          <g key={w.from}>
            <title>{`${w.from} to ${w.to}: +${w.gained} new, −${w.lost} lost`}</title>
            {w.gained > 0 && <path className="bar-up" d={bar(cx - bw / 2, mid, bw, -(w.gained / max) * half)} />}
            {w.lost > 0 && <path className="bar-down" d={bar(cx - bw / 2, mid, bw, (w.lost / max) * half)} />}
            {(i === 0 || i === weeks.length - 1 || i === Math.floor(weeks.length / 2)) && (
              <text className="tick" x={cx} y={H - 6} textAnchor="middle">{w.to.slice(5)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** One stacked column per audit: errors at the base, then warnings, then notices. */
export function StackedBars({ audits }: { audits: { id: string; date: string; error: number; warning: number; notice: number }[] }) {
  const W = 680, H = 240, L = 36, R = 8, T = 10, B = 26;
  const max = Math.max(1, ...audits.map((a) => a.error + a.warning + a.notice));
  const ph = H - T - B, slot = (W - L - R) / audits.length, bw = Math.min(32, slot * 0.45);
  const y = (v: number) => T + ph - (v / max) * ph;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bars-svg" role="img"
      aria-label={`Findings per audit: ${audits.map((a) => `${a.date} ${a.error} errors, ${a.warning} warnings, ${a.notice} notices`).join("; ")}.`}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      {audits.map((a, i) => {
        const x = L + slot * i + (slot - bw) / 2;
        let base = 0;
        const part = (v: number, cls: string) => {
          if (!v) return null;
          const el = <rect className={cls} x={x} y={y(base + v)} width={bw} height={y(base) - y(base + v)} />;
          base += v;
          return el;
        };
        return (
          <g key={a.id}>
            <title>{`${a.date}: ${a.error} errors, ${a.warning} warnings, ${a.notice} notices`}</title>
            {part(a.error, "seg-error")}
            {part(a.warning, "seg-warning")}
            {part(a.notice, "seg-notice")}
            <text className="tick" x={x + bw / 2} y={H - 6} textAnchor="middle">{a.date.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 0–100 scores over time, one line per series, with the 90 and 50 bands Lighthouse uses. */
export function ScoreLine({ series }: { series: { name: string; className: string; points: { date: string; value: number }[] }[] }) {
  const W = 680, H = 220, L = 36, R = 12, T = 10, B = 26;
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const pw = W - L - R, ph = H - T - B;
  const x = (d: string) => L + (dates.length > 1 ? (dates.indexOf(d) / (dates.length - 1)) * pw : pw / 2);
  const y = (v: number) => T + ph - (v / 100) * ph;
  const gid = React.useId().replace(/:/g, "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bars-svg" role="img"
      aria-label={series.map((s) => `${s.name}: ${s.points.map((p) => `${p.date} ${p.value}`).join(", ")}`).join("; ")}>
      {[0, 50, 90].map((t) => (
        <g key={t}>
          <line className={t === 90 ? "grid grid--good" : t === 50 ? "grid grid--poor" : "grid"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {series.map((s, n) => (
        <g key={s.name} className={s.className}>
          {n === 0 && s.points.length > 1 && (
            <>
              <AreaGradient id={`${gid}-${n}`} />
              <path className="score-area" fill={`url(#${gid}-${n})`}
                d={`${curve(s.points.map((p) => [x(p.date), y(p.value)]))} L${x(s.points[s.points.length - 1].date)} ${y(0)} L${x(s.points[0].date)} ${y(0)} Z`} />
            </>
          )}
          <path className="score-line" d={curve(s.points.map((p) => [x(p.date), y(p.value)]))} />
          {s.points.map((p) => (
            <circle key={p.date} className="score-dot" cx={x(p.date)} cy={y(p.value)} r="3.5"><title>{`${s.name} ${p.date}: ${p.value}`}</title></circle>
          ))}
        </g>
      ))}
      {dates.length > 0 && [dates[0], dates[dates.length - 1]].map((d, i) => (
        <text key={i} className="tick" x={x(d)} y={H - 6} textAnchor={dates.length > 1 ? (i ? "end" : "start") : "middle"}>{d.slice(5)}</text>
      ))}
    </svg>
  );
}
