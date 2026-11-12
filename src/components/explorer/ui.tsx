import React, { useRef } from "react";
import { AlertCircle, RotateCw, SearchX } from "lucide-react";
import { display } from "../../services/measurements";

/** Tabs with roving focus: ArrowLeft/ArrowRight/Home/End move and select, as in the ARIA tabs pattern. */
export function SegmentedTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = "pill",
  idBase,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  variant?: "pill" | "underline";
  /** When set, each tab controls the panel with id `${idBase}-panel`. */
  idBase?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  const index = options.findIndex((o) => o.value === value);
  return (
    <div role="tablist" aria-label={label} className={`seg seg--${variant}`}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={idBase ? `${idBase}-tab-${o.value}` : undefined}
          aria-controls={idBase ? `${idBase}-panel` : undefined}
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="seg-tab"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") move(index + 1);
            else if (e.key === "ArrowLeft") move(index - 1);
            else if (e.key === "Home") move(0);
            else if (e.key === "End") move(options.length - 1);
            else return;
            e.preventDefault();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Period-over-period change. `lowerIsBetter` flips the colour for ranks. */
export function DeltaBadge({ value, lowerIsBetter = false }: { value: number; lowerIsBetter?: boolean }) {
  if (!Number.isFinite(value)) return <span className="delta delta--none">No comparison</span>;
  const flat = Math.abs(value) < 0.05;
  const good = lowerIsBetter ? value < 0 : value > 0;
  const sign = flat ? "" : value > 0 ? "+" : "−";
  return (
    <span className={`delta ${flat ? "delta--flat" : good ? "delta--up" : "delta--down"}`}>
      {sign}
      {display(Math.abs(value))}%
    </span>
  );
}

/** Inline trend line; NaN values break the line rather than dropping to zero. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return <span className="sparkline sparkline--empty" aria-hidden="true" />;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const w = 96;
  const h = 28;
  const d = values
    .map((v, i) =>
      Number.isFinite(v)
        ? `${i === 0 || !Number.isFinite(values[i - 1]) ? "M" : "L"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`
        : "",
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export const Skeleton = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
);

/** Empty or failed widget body, sized to the widget so nothing below it moves. */
export function WidgetState({
  kind,
  title,
  body,
  onRetry,
  action,
}: {
  kind: "empty" | "error";
  title: string;
  body?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  const Icon = kind === "error" ? AlertCircle : SearchX;
  return (
    <div className={`widget-state widget-state--${kind}`} role={kind === "error" ? "alert" : undefined}>
      <Icon className="widget-state-icon" aria-hidden="true" />
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          <RotateCw className="w-4 h-4" aria-hidden="true" /> Retry
        </button>
      )}
      {action}
    </div>
  );
}

/** Long URL or keyword cut to one line; the full text stays available on hover and to screen readers. */
export const Truncate = ({ text, className = "" }: { text: string; className?: string }) => (
  <span className={`truncate-cell ${className}`} title={text}>
    {text}
  </span>
);
