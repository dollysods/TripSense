import type { ItineraryResult } from '../types';
import { WAKING_HOURS_PER_DAY, formatHours, formatMin } from '../lib/calc';

interface Props {
  result: ItineraryResult;
}

export default function ResultsDisplay({ result }: Props) {
  if (result.perCity.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 font-medium text-right">Nights</th>
            <th className="px-4 py-3 font-medium text-right">Transit in</th>
            <th className="px-4 py-3 font-medium text-right">Waking hours</th>
            <th className="px-4 py-3 font-medium text-right">≈ Full days</th>
          </tr>
        </thead>
        <tbody>
          {result.perCity.map((city, i) => {
            const daytrip = city.kind === 'daytrip';
            return (
              <tr key={`${city.cityId}-${i}`} className="border-b border-slate-100 last:border-0">
                <td className={`px-4 py-3 font-medium ${daytrip ? 'pl-10 text-slate-600' : 'text-slate-800'}`}>
                  {daytrip && <span aria-hidden className="mr-1 text-indigo-400">↳</span>}
                  {city.cityName}
                  {daytrip && <span className="ml-1.5 text-xs font-normal text-indigo-500">day trip</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{daytrip ? '—' : city.nights}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {city.transitInMin > 0
                    ? `${formatMin(city.transitInMin)}${daytrip ? ' ⇄' : ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  {formatHours(city.wakingHours)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {city.equivalentDays.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold text-slate-800">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right">{result.totalNights}</td>
            <td className="px-4 py-3 text-right text-rose-600">
              {formatMin(result.totalTransitMin)} in transit
            </td>
            <td className="px-4 py-3 text-right">{formatHours(result.totalWakingHours)}</td>
            <td className="px-4 py-3 text-right">
              {(result.totalWakingHours / WAKING_HOURS_PER_DAY).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="px-4 py-2.5 text-xs text-slate-400">
        Waking hours = nights × {WAKING_HOURS_PER_DAY}h − transit into the city. Assumes 8h sleep.
        Day trips (↳, transit shown ⇄ round trip) spend their base city's hours — nights stay with
        the base. Times are typical-schedule estimates including door-to-door overhead, not guarantees.
      </p>
    </div>
  );
}
