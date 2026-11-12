import React from "react";

interface HealthGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({
  score,
  size = 140,
  strokeWidth = 12,
  label = "Site Health",
  sublabel = "Based on crawled issues",
}) => {
  if (!Number.isFinite(score))
    return (
      <div className="text-center p-6 text-gray-500">
        Audit score unavailable. View measured findings in On-Page SEO Checker.
      </div>
    );
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = "var(--color-cool)";
  let glowColor = "rgba(37, 99, 235, 0.25)";
  let gradeText = "Excellent";

  if (score < 60) {
    color = "var(--color-bad)"; // red
    glowColor = "rgba(239, 68, 68, 0.25)";
    gradeText = "Critical";
  } else if (score < 80) {
    color = "var(--color-accent)"; // amber
    glowColor = "rgba(245, 158, 11, 0.25)";
    gradeText = "Fair";
  } else if (score < 90) {
    color = "var(--color-ok)"; // emerald
    glowColor = "rgba(16, 185, 129, 0.25)";
    gradeText = "Good";
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-dark-border"
            fill="transparent"
          />
          {/* Animated score circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 1s ease-in-out, stroke 0.5s ease",
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>

        {/* Inner score label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-extrabold tracking-tight font-heading text-gray-900 dark:text-white">
            {score}%
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5"
            style={{ backgroundColor: glowColor, color }}
          >
            {gradeText}
          </span>
        </div>
      </div>

      {label && (
        <div className="mt-3">
          <div className="font-heading font-semibold text-sm text-gray-900 dark:text-gray-100">
            {label}
          </div>
          {sublabel && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
