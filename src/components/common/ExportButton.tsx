import React from "react";
import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  label = "Export CSV",
  className = "",
  size = "md",
}) => {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 font-medium rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-700 dark:text-gray-200 shadow-sm transition-colors duration-150 active:scale-95 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${className}`}
      title="Export data to CSV spreadsheet"
    >
      <Download
        className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} text-razza-600 dark:text-razza-400`}
      />
      <span>{label}</span>
    </button>
  );
};
