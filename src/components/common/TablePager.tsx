import React from "react";
export const TablePager: React.FC<{
  page: number;
  total: number;
  onChange: (page: number) => void;
}> = ({ page, total, onChange }) => {
  const count = Math.max(1, Math.ceil(total / 25));
  const current = Math.min(page, count);
  return (
    <nav
      aria-label="Table pagination"
      className="flex items-center justify-between gap-3 p-4 text-xs text-slate-500"
    >
      <span>
        {total
          ? `${(current - 1) * 25 + 1}–${Math.min(total, current * 25)} of ${total} records`
          : "No matching records"}
      </span>
      <div className="flex items-center gap-3">
        <button
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
          className="border rounded-lg px-3 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {current} of {count}
        </span>
        <button
          disabled={current >= count}
          onClick={() => onChange(current + 1)}
          className="border rounded-lg px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
};
