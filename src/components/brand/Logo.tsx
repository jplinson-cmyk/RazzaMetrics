import React, { useId } from "react";

/**
 * The Razza Metrics mark: the Razza hexagon built from three rising bars (charcoal, leaf, lime),
 * clipped to the hexagon so the silhouette stays in the Razza family. The charcoal bar follows
 * --logo-ink, so it turns light on charcoal surfaces.
 */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = "" }) => {
  const clip = `hex-${useId().replace(/:/g, "")}`;
  return (
    <svg className={`logo-mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d="M32 3.5 57 18v28L32 60.5 7 46V18Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect className="logo-bar-1" x="7" y="31" width="15.5" height="33" rx="2" />
        <rect className="logo-bar-2" x="24.25" y="18" width="15.5" height="46" rx="2" />
        <rect className="logo-bar-3" x="41.5" y="4" width="15.5" height="60" rx="2" />
      </g>
      <path className="logo-hex" d="M32 3.5 57 18v28L32 60.5 7 46V18Z" fill="none" />
    </svg>
  );
};

/** Mark plus wordmark. `compact` drops the words (the collapsed sidebar rail). */
export const Logo: React.FC<{ compact?: boolean; size?: number }> = ({ compact = false, size = 28 }) => (
  <span className="logo">
    <LogoMark size={size} />
    {compact ? <span className="visually-hidden">Razza Metrics</span> : <span className="logo-word">Razza Metrics</span>}
  </span>
);
