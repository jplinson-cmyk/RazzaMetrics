import React, { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmt = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** The exact dates in view, with month shortcuts and a custom From/To. Closes on Apply, Cancel or Escape. */
export function DateRange({ start, end, onApply }: { start: string; end: string; onApply: (start: string, end: string) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  useEffect(() => {
    setFrom(start);
    setTo(end);
  }, [start, end, open]);

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = iso(now.getTime());
  const shortcuts: [string, string, string][] = [
    ["This month", iso(Date.UTC(y, m, 1)), today],
    ["Last month", iso(Date.UTC(y, m - 1, 1)), iso(Date.UTC(y, m, 0))],
    ["Last 90 days", iso(now.getTime() - 89 * 86400000), today],
  ];
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const valid = days > 0 && days <= 366;
  const apply = (a: string, b: string) => {
    onApply(a, b);
    setOpen(false);
  };

  return (
    <div className="date-range" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button type="button" className="date-range-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        <CalendarDays className="w-4 h-4" aria-hidden="true" />
        {fmt(start)} – {fmt(end)}
      </button>
      {open && (
        <div className="date-range-panel" role="dialog" aria-label="Choose dates">
          <div className="date-range-shortcuts">
            {shortcuts.map(([label, a, b]) => (
              <button key={label} type="button" aria-pressed={a === start && b === end} onClick={() => apply(a, b)}>
                {label}
              </button>
            ))}
          </div>
          <div className="date-range-fields">
            <label className="login-field">
              <span>From</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="login-field">
              <span>To</span>
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="date-range-foot">
            <span>{valid ? `${days} days` : "Choose up to 366 days"}</span>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="workspace-action" disabled={!valid} onClick={() => apply(from, to)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
