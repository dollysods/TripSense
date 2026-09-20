interface Props {
  startDate: string;
  returnByDate: string;
  onStartDateChange: (value: string) => void;
  onReturnByDateChange: (value: string) => void;
}

/**
 * Optional trip-dates fields (v1.2a). Both are native <input type="date">
 * so typing a date works as well as picking one. Neither is required —
 * leaving both blank reproduces exact v1 (nights-only) behavior.
 */
export default function TripDatesInput({
  startDate,
  returnByDate,
  onStartDateChange,
  onReturnByDateChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <label className="flex items-center gap-2 text-slate-600">
        <span>Trip starts</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-slate-800"
          aria-label="Trip start date"
        />
      </label>
      <label
        className={`flex items-center gap-2 ${startDate ? 'text-slate-600' : 'text-slate-300'}`}
        title={startDate ? undefined : 'Set a start date first'}
      >
        <span>Return by</span>
        <input
          type="date"
          value={returnByDate}
          disabled={!startDate}
          onChange={(e) => onReturnByDateChange(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 disabled:bg-slate-50 disabled:text-slate-300"
          aria-label="Return-by date"
        />
      </label>
      {!startDate && (
        <span className="text-xs text-slate-400">
          optional — add a start date to see calendar dates and check your return flight timing
        </span>
      )}
    </div>
  );
}
