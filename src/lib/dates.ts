import type { ItineraryResult } from '../types';

/**
 * Trip-dates math (v1.2a). Pure date arithmetic layered on top of the
 * existing waking-hours engine (calc.ts) — no new dataset fields, no
 * change to calcItinerary. Entirely additive: every function here
 * accepts an optional start date and returns null/no-ops when it's
 * unset, so the nights-only v1 behavior is unchanged unless the
 * traveler opts in.
 *
 * Two locked scope decisions (v1.2 open decisions, resolved 2026-09-20):
 * - Whole-day granularity only: a stay's checkout date is its arrival
 *   date plus its night count, with no fractional-day adjustment for
 *   transit time. We don't track clock times (see next point), so we
 *   can't tell which legs actually cross midnight — rather than guess,
 *   travel is treated as same-day (depart and arrive on the checkout /
 *   check-in date), and only nights move the calendar forward. This is
 *   the "full day, no fractional bookkeeping" choice applied consistently:
 *   it's the only reading of that decision that doesn't silently require
 *   clock-time data we don't have.
 * - Timezone-naive: cities.json has no timezone field, so dates are
 *   calendar days only, never clock times.
 */

/** One calendar-date window for a stay row: check-in and check-out. */
export interface StopDates {
  /** ISO yyyy-mm-dd — the day the traveler checks in. */
  arrival: string;
  /** ISO yyyy-mm-dd — the day the traveler checks out (arrival + nights). */
  departure: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Per-row date windows, parallel to result.perCity. Stay rows get their
 * own arrival/departure; a day-trip row gets its base's window (it
 * doesn't consume nights or move the calendar — v1.1b behavior), the
 * same convention the "Nights" column already uses ('—' for day trips).
 * Returns an all-null array when startDate is unset.
 */
export function computeStopDates(
  result: ItineraryResult,
  startDate: string | undefined,
): (StopDates | null)[] {
  if (!startDate) return result.perCity.map(() => null);

  const dates: (StopDates | null)[] = [];
  let cursor = startDate;
  let lastStay: StopDates | null = null;

  for (const city of result.perCity) {
    if (city.kind === 'daytrip') {
      dates.push(lastStay);
      continue;
    }
    const stay: StopDates = { arrival: cursor, departure: addDays(cursor, city.nights) };
    dates.push(stay);
    lastStay = stay;
    cursor = stay.departure;
  }
  return dates;
}

/** The trip's overall end date: checkout date of the last stay. Null if
 *  no start date is set, or the itinerary has no stay rows yet. */
export function tripEndDate(result: ItineraryResult, startDate: string | undefined): string | null {
  const dates = computeStopDates(result, startDate);
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i]) return dates[i]!.departure;
  }
  return null;
}

export type ReturnComparison =
  | { status: 'fits'; daysToSpare: number }
  | { status: 'exact' }
  | { status: 'over'; daysOver: number };

/**
 * Compares the itinerary's computed end date against a booked return-by
 * date. Whole-day granularity only — see the module comment; there's no
 * clock-time precision to report an hours figure.
 */
export function compareReturnDate(
  endDate: string | null,
  returnByDate: string | undefined,
): ReturnComparison | null {
  if (!endDate || !returnByDate) return null;
  const end = new Date(`${endDate}T00:00:00`).getTime();
  const ret = new Date(`${returnByDate}T00:00:00`).getTime();
  const diffDays = Math.round((ret - end) / 86_400_000);
  if (diffDays > 0) return { status: 'fits', daysToSpare: diffDays };
  if (diffDays === 0) return { status: 'exact' };
  return { status: 'over', daysOver: -diffDays };
}

/** One line of text summarizing a ReturnComparison, or null. */
export function returnComparisonMessage(cmp: ReturnComparison | null): string | null {
  if (!cmp) return null;
  if (cmp.status === 'exact') return 'Itinerary ends exactly on your return date.';
  if (cmp.status === 'fits') {
    return `Itinerary ends ${cmp.daysToSpare} day${cmp.daysToSpare === 1 ? '' : 's'} before your return date.`;
  }
  return `⚠ Itinerary runs ${cmp.daysOver} day${cmp.daysOver === 1 ? '' : 's'} past your return date.`;
}

/** Short display form, e.g. "May 12". Locale-aware (uses the browser's
 *  locale), calendar-day only — no time-of-day component. */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** "May 12 – May 25" for a stay window, or a single date if it's a
 *  same-day (0-night) edge case. */
export function formatStayRange(stay: StopDates): string {
  return stay.arrival === stay.departure
    ? formatDate(stay.arrival)
    : `${formatDate(stay.arrival)} – ${formatDate(stay.departure)}`;
}
