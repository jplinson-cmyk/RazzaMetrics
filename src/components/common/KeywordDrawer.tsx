import React, { useEffect, useRef } from "react";
import { useProject } from "../../context/ProjectContext";
import { aggregate, display } from "../../services/measurements";
import { RankTrendChart } from "./ChartComponents";
import { KeywordEvidence } from "./RecordActions";
export const KeywordDrawer: React.FC<{
  keyword: string;
  open: boolean;
  onClose: () => void;
}> = ({ keyword, open, onClose }) => {
  const { snapshot, filters } = useProject();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const records =
    snapshot?.performance.filter(
      (r) => r.keyword.toLowerCase() === keyword.toLowerCase(),
    ) || [];
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const totals = aggregate(records);
  return (
    <dialog
      ref={dialog}
      className="detail-drawer"
      aria-label="Keyword details"
      onClose={onClose}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <span className="text-xs text-blue-600 font-semibold">
            Keyword insights
          </span>
          <h2 className="text-2xl font-bold mt-2">{keyword}</h2>
          <p className="text-xs text-slate-500 mt-2">
            {filters.start} to {filters.end}, Google Search Console average
            position
          </p>
        </div>
        <button onClick={onClose} className="border rounded-lg px-3 py-2">
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 my-6">
        {[
          ["Clicks", records.length ? totals.clicks : NaN],
          ["Impressions", records.length ? totals.impressions : NaN],
          ["Average position", totals.position],
          ["CTR (%)", totals.ctr],
        ].map(([name, value]) => (
          <div className="border rounded-xl p-4" key={name}>
            <p className="text-xs text-slate-500">{name}</p>
            <strong className="text-2xl">{display(value as number)}</strong>
          </div>
        ))}
      </div>
      <RankTrendChart
        data={dates.map(
          (date) => aggregate(records.filter((r) => r.date === date)).position,
        )}
        labels={dates}
        keyword={keyword}
      />
      {!records.length && (
        <p className="text-sm text-slate-500 my-5">
          No measurements for this query in the selected period. Synchronize GSC
          or adjust the date range.
        </p>
      )}
      <KeywordEvidence keyword={keyword} />
    </dialog>
  );
};
