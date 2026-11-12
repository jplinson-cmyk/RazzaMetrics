import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  delta?: string | number;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  delta,
  deltaType = "positive",
  subtitle,
  icon,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-dark-card border border-gray-200/80 dark:border-dark-border rounded-xl p-5 shadow-sm transition-colors duration-200 ${
        onClick
          ? "cursor-pointer hover:border-razza-500/50 hover:shadow-glow-sm hover:-translate-y-0.5"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {title}
        </span>
        {icon && (
          <div className="p-2 rounded-lg bg-razza-50 dark:bg-razza-900/30 text-razza-600 dark:text-razza-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 dark:text-white">
          {value}
        </span>

        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              deltaType === "positive"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                : deltaType === "negative"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {deltaType === "positive" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : deltaType === "negative" ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {delta}
          </span>
        )}

        {badge && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-medium ml-auto">
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
