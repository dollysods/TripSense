import type {
  CitiesDatabase,
  CityPairsDatabase,
  CityResult,
  ItineraryResult,
  Leg,
  LegVia,
  Stop,
  TransportMode,
} from '../types';
import { TRANSPORT_MODES } from '../types';

export const SLEEP_HOURS_PER_NIGHT = 8;
export const WAKING_HOURS_PER_DAY = 24 - SLEEP_HOURS_PER_NIGHT;

/**
 * Door-to-door overhead added on top of the scheduled vehicle time.
 * Station/airport access, check-in, security, boarding. Without this,
 * plane legs look unrealistically cheap next to train legs (city-center
 * station vs. airport 40 min out of town + security).
 */
export const MODE_OVERHEAD_MIN: Record<TransportMode, number> = {
  train: 20,
  plane: 120,
  bus: 20,
  car: 0,
};

export function pairKey(originId: string, destId: string): string {
  return `${originId}_${destId}`;
}

/** Scheduled vehicle time from the dataset, or null if no data / no service. */
export function lookupTimeMin(
  pairs: CityPairsDatabase,
  originId: string,
  destId: string,
  mode: TransportMode,
): number | null {
  const pair = pairs[pairKey(originId, destId)];
  const data = pair?.modes?.[mode];
  return data ? data.time_min : null;
}

/** Door-to-door minutes for a leg routed through an intermediate city:
 *  both segments' scheduled time plus each segment's mode overhead.
 *  Null if either segment has no data (e.g. cities changed since the
 *  via was chosen). */
export function viaLegMin(
  pairs: CityPairsDatabase,
  originId: string,
  destId: string,
  via: LegVia,
): number | null {
  const t1 = lookupTimeMin(pairs, originId, via.cityId, via.modes[0]);
  const t2 = lookupTimeMin(pairs, via.cityId, destId, via.modes[1]);
  if (t1 === null || t2 === null) return null;
  return t1 + MODE_OVERHEAD_MIN[via.modes[0]] + t2 + MODE_OVERHEAD_MIN[via.modes[1]];
}

/** Best single-transfer routing for a pair with no direct data: the
 *  intermediate city and mode combination minimizing door-to-door time.
 *  Null when no city connects to both ends. */
export function bestVia(
  pairs: CityPairsDatabase,
  cities: CitiesDatabase,
  originId: string,
  destId: string,
): (LegVia & { totalMin: number }) | null {
  let best: (LegVia & { totalMin: number }) | null = null;
  for (const viaId of Object.keys(cities)) {
    if (viaId === originId || viaId === destId) continue;
    for (const m1 of TRANSPORT_MODES) {
      const t1 = lookupTimeMin(pairs, originId, viaId, m1);
      if (t1 === null) continue;
      for (const m2 of TRANSPORT_MODES) {
        const t2 = lookupTimeMin(pairs, viaId, destId, m2);
        if (t2 === null) continue;
        const totalMin =
          t1 + MODE_OVERHEAD_MIN[m1] + t2 + MODE_OVERHEAD_MIN[m2];
        if (!best || totalMin < best.totalMin) {
          best = { cityId: viaId, modes: [m1, m2], totalMin };
        }
      }
    }
  }
  return best;
}

/** Effective leg time in minutes: override > via routing > dataset + overhead > null. */
export function effectiveLegMin(
  pairs: CityPairsDatabase,
  origin: Stop,
  dest: Stop,
  leg: Leg,
): number | null {
  if (leg.overrideMin !== undefined) return leg.overrideMin;
  if (!origin.cityId || !dest.cityId) return null;
  if (leg.via) return viaLegMin(pairs, origin.cityId, dest.cityId, leg.via);
  const scheduled = lookupTimeMin(pairs, origin.cityId, dest.cityId, leg.mode);
  return scheduled === null ? null : scheduled + MODE_OVERHEAD_MIN[leg.mode];
}

/** A stop participates in the calculation once it has a dataset city or
 *  a custom (off-list) name. */
export function isPlaced(s: Stop): boolean {
  return s.cityId !== null || !!s.customName?.trim();
}

export function stopDisplayName(s: Stop, cities: CitiesDatabase): string {
  if (s.cityId) return cities[s.cityId]?.name ?? s.cityId;
  return s.customName?.trim() ?? '?';
}

/** A stop acts as a day trip only when a base exists before it. */
export function isEffectiveDaytrip(stop: Stop, idx: number, placed: Stop[]): boolean {
  return (
    stop.kind === 'daytrip' &&
    idx > 0 &&
    placed.slice(0, idx).some((p) => p.kind !== 'daytrip')
  );
}

/** The stop the traveler is physically at after visiting placed[idx]:
 *  a day trip returns them to its base. */
function locationAfter(placed: Stop[], idx: number): Stop {
  for (let i = idx; i >= 0; i--) {
    if (!isEffectiveDaytrip(placed[i], i, placed)) return placed[i];
  }
  return placed[idx];
}

/**
 * Core formula. Each stay's budget is nights × 16 waking hours; the
 * transit of the leg *arriving* there is paid out of that city's budget
 * (the 7-hour train to Prague costs you Prague time).
 *
 * Day trips (v1.1b): the round trip (2× one-way, overhead both ways)
 * plus the hours spent on site are paid out of the BASE city's budget;
 * nights stay with the base. On-site hours default to 16 − round-trip
 * transit, overridable per stop. The next leg departs from the base.
 */
export function calcItinerary(
  stops: Stop[],
  legs: Leg[],
  cities: CitiesDatabase,
  pairs: CityPairsDatabase,
): ItineraryResult {
  const placed = stops.filter(isPlaced);

  // First pass: per-stop transit + provisional hours; remember each
  // stay's budget so day-trip costs can be charged back to it.
  const rows: CityResult[] = [];
  const budgets: number[] = []; // parallel to rows; stays only (NaN for day trips)
  let lastStayRow = -1;

  placed.forEach((stop, idx) => {
    const daytrip = isEffectiveDaytrip(stop, idx, placed);
    const name = stopDisplayName(stop, cities);

    let transitInMin = 0;
    if (idx > 0) {
      // Legs sit between consecutive raw stops; the leg arriving here is
      // the one after the previous placed stop. Its effective origin is
      // wherever the traveler actually is (day trips return to base).
      const legIdx = stops.indexOf(placed[idx - 1]);
      const leg = legs[legIdx] ?? { mode: 'train' as const };
      const origin = locationAfter(placed, idx - 1);
      const oneWay = effectiveLegMin(pairs, origin, stop, leg) ?? 0;
      transitInMin = daytrip ? oneWay * 2 : oneWay;
    }

    if (daytrip) {
      const onSite =
        stop.onSiteHours ?? Math.max(0, WAKING_HOURS_PER_DAY - transitInMin / 60);
      // Charge the base: round-trip transit + hours spent on site.
      if (lastStayRow >= 0) {
        budgets[lastStayRow] -= transitInMin / 60 + onSite;
      }
      rows.push({
        cityId: stop.cityId ?? `custom-${name}`,
        cityName: name,
        kind: 'daytrip',
        nights: 0,
        transitInMin,
        wakingHours: onSite,
        equivalentDays: onSite / WAKING_HOURS_PER_DAY,
      });
      budgets.push(NaN);
    } else {
      rows.push({
        cityId: stop.cityId ?? `custom-${name}`,
        cityName: name,
        kind: 'stay',
        nights: stop.nights,
        transitInMin,
        wakingHours: 0, // finalized below from the (possibly charged) budget
        equivalentDays: 0,
      });
      budgets.push(stop.nights * WAKING_HOURS_PER_DAY - transitInMin / 60);
      lastStayRow = rows.length - 1;
    }
  });

  // Second pass: finalize stay hours after day-trip charges.
  const perCity = rows.map((row, i) => {
    if (row.kind === 'daytrip') return row;
    const wakingHours = Math.max(0, budgets[i]);
    return { ...row, wakingHours, equivalentDays: wakingHours / WAKING_HOURS_PER_DAY };
  });

  return {
    perCity,
    totalWakingHours: perCity.reduce((s, c) => s + c.wakingHours, 0),
    totalTransitMin: perCity.reduce((s, c) => s + c.transitInMin, 0),
    totalNights: perCity.reduce((s, c) => s + c.nights, 0),
  };
}

export function formatHours(h: number): string {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return min === 0 ? `${whole}h` : `${whole}h ${min.toString().padStart(2, '0')}m`;
}

export function formatMin(min: number): string {
  return formatHours(min / 60);
}
