import type {
  CitiesDatabase,
  CityPairsDatabase,
  ItineraryResult,
  Leg,
  Stop,
  TransportMode,
} from '../types';

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

/** Effective leg time in minutes: override > dataset + overhead > null. */
export function effectiveLegMin(
  pairs: CityPairsDatabase,
  origin: Stop,
  dest: Stop,
  leg: Leg,
): number | null {
  if (leg.overrideMin !== undefined) return leg.overrideMin;
  if (!origin.cityId || !dest.cityId) return null;
  const scheduled = lookupTimeMin(pairs, origin.cityId, dest.cityId, leg.mode);
  return scheduled === null ? null : scheduled + MODE_OVERHEAD_MIN[leg.mode];
}

/**
 * Core v1 formula. Each city's budget is nights × 16 waking hours; the
 * transit time of the leg *arriving* into that city is paid out of that
 * city's budget (the 7-hour train to Prague costs you Prague time).
 */
export function calcItinerary(
  stops: Stop[],
  legs: Leg[],
  cities: CitiesDatabase,
  pairs: CityPairsDatabase,
): ItineraryResult {
  const perCity = stops
    .filter((s): s is Stop & { cityId: string } => s.cityId !== null)
    .map((stop, idx, placed) => {
      let transitInMin = 0;
      if (idx > 0) {
        const legIdx = stops.indexOf(placed[idx - 1]);
        const leg = legs[legIdx];
        transitInMin = effectiveLegMin(pairs, placed[idx - 1], stop, leg) ?? 0;
      }
      const budget = stop.nights * WAKING_HOURS_PER_DAY;
      const wakingHours = Math.max(0, budget - transitInMin / 60);
      return {
        cityId: stop.cityId,
        cityName: cities[stop.cityId]?.name ?? stop.cityId,
        nights: stop.nights,
        transitInMin,
        wakingHours,
        equivalentDays: wakingHours / WAKING_HOURS_PER_DAY,
      };
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
