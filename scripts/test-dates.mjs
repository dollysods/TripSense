/**
 * Engine unit tests for trip-dates math (v1.2a). Pure date arithmetic,
 * no dataset dependency. Bundles src/lib/{dates,calc}.ts via esbuild:
 *   node scripts/test-dates.mjs
 */
import { execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = await mkdtemp(join(tmpdir(), 'tripsense-dates-'));
const bundle = join(tmp, 'dates.mjs');
execSync(`npx esbuild src/lib/dates.ts --bundle --format=esm --outfile=${bundle}`, { stdio: 'pipe' });
const dates = await import(bundle);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const stay = (cityId, nights) => ({ cityId, cityName: cityId, kind: 'stay', nights, transitInMin: 0, wakingHours: 0, equivalentDays: 0 });
const daytrip = (cityId) => ({ cityId, cityName: cityId, kind: 'daytrip', nights: 0, transitInMin: 0, wakingHours: 0, equivalentDays: 0 });
const result = (perCity) => ({ perCity, totalWakingHours: 0, totalTransitMin: 0, totalNights: perCity.reduce((s, c) => s + c.nights, 0) });

// ---- computeStopDates: unset start date is a no-op ----
{
  const r = result([stay('vienna', 2), stay('prague', 3)]);
  const d = dates.computeStopDates(r, undefined);
  check('unset start date: all-null array, same length', d.length === 2 && d.every((x) => x === null));
}

// ---- computeStopDates: simple multi-stay trip ----
{
  const r = result([stay('vienna', 2), stay('prague', 3), stay('berlin', 1)]);
  const d = dates.computeStopDates(r, '2026-05-10');
  check('vienna arrival = start date', d[0].arrival === '2026-05-10');
  check('vienna departure = start + 2 nights', d[0].departure === '2026-05-12');
  check('prague arrival = vienna departure (same-day travel)', d[1].arrival === '2026-05-12');
  check('prague departure = arrival + 3 nights', d[1].departure === '2026-05-15');
  check('berlin arrival = prague departure', d[2].arrival === '2026-05-15');
  check('berlin departure = arrival + 1 night', d[2].departure === '2026-05-16');
}

// ---- computeStopDates: day trips don't advance the calendar ----
{
  const r = result([stay('vienna', 3), daytrip('bratislava'), stay('prague', 2)]);
  const d = dates.computeStopDates(r, '2026-06-01');
  check('day trip inherits its base\'s window, not null', d[1] !== null && d[1].arrival === '2026-06-01' && d[1].departure === '2026-06-04');
  check('day trip does not advance the calendar for the next stay', d[2].arrival === '2026-06-04');
}

// ---- computeStopDates: month/year rollover ----
{
  const r = result([stay('lisbon', 25), stay('porto', 10)]);
  const d = dates.computeStopDates(r, '2026-12-20');
  check('rolls over month + year correctly', d[1].arrival === '2027-01-14', d[1].arrival);
}

// ---- tripEndDate ----
{
  const r = result([stay('vienna', 2), stay('prague', 3)]);
  check('tripEndDate = last stay departure', dates.tripEndDate(r, '2026-05-10') === '2026-05-15');
  check('tripEndDate null when no start date', dates.tripEndDate(r, undefined) === null);
}

{
  // Itinerary ending on a day trip: end date is still the real last stay's departure.
  const r = result([stay('vienna', 3), stay('prague', 2), daytrip('kutna_hora')]);
  check('tripEndDate ignores a trailing (invalid) day-trip row', dates.tripEndDate(r, '2026-05-10') === '2026-05-15');
}

// ---- compareReturnDate ----
{
  check('fits: positive spare days', JSON.stringify(dates.compareReturnDate('2026-05-15', '2026-05-18')) === JSON.stringify({ status: 'fits', daysToSpare: 3 }));
  check('exact: same day', JSON.stringify(dates.compareReturnDate('2026-05-15', '2026-05-15')) === JSON.stringify({ status: 'exact' }));
  check('over: itinerary runs past return date', JSON.stringify(dates.compareReturnDate('2026-05-15', '2026-05-14')) === JSON.stringify({ status: 'over', daysOver: 1 }));
  check('null when end date unset', dates.compareReturnDate(null, '2026-05-14') === null);
  check('null when return date unset', dates.compareReturnDate('2026-05-15', undefined) === null);
}

// ---- returnComparisonMessage ----
{
  check('fits message', dates.returnComparisonMessage({ status: 'fits', daysToSpare: 1 }) === 'Itinerary ends 1 day before your return date.');
  check('fits message pluralizes', dates.returnComparisonMessage({ status: 'fits', daysToSpare: 3 }).includes('3 days before'));
  check('exact message', dates.returnComparisonMessage({ status: 'exact' }) === 'Itinerary ends exactly on your return date.');
  check('over message warns and pluralizes', dates.returnComparisonMessage({ status: 'over', daysOver: 2 }).includes('⚠') && dates.returnComparisonMessage({ status: 'over', daysOver: 2 }).includes('2 days past'));
  check('null comparison -> null message', dates.returnComparisonMessage(null) === null);
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
