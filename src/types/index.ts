export type TransportMode = 'train' | 'plane' | 'bus' | 'car';

export const TRANSPORT_MODES: TransportMode[] = ['train', 'plane', 'bus', 'car'];

export interface ModeData {
  time_min: number;
  direct: boolean;
}

export interface CityPair {
  modes: Partial<Record<TransportMode, ModeData | null>>;
}

export type CityPairsDatabase = Record<string, CityPair>;

export interface City {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** false = no airport with meaningful scheduled service (Lugano, Cinque Terre). */
  airport?: boolean;
  /** false = car access effectively prohibited/impractical (Cinque Terre villages). */
  car?: boolean;
}

export type CitiesDatabase = Record<string, City>;

/** One destination in the itinerary, in order. */
export interface Stop {
  /** Stable key for React lists / dnd-kit, not the city id. */
  id: string;
  cityId: string | null;
  nights: number;
  /** 'stay' (default) books nights here; 'daytrip' is a same-day round
   *  trip from the nearest preceding stay stop — nights and the time
   *  cost stay attributed to that base city. */
  kind?: 'stay' | 'daytrip';
  /** Day trips: manual hours on site, replacing the default
   *  (16 − round-trip transit). */
  onSiteHours?: number;
  /** Off-list destination (e.g. Hallstatt): free-text name used when
   *  cityId is null. No dataset times — leg overrides are the path. */
  customName?: string;
}

/** A same-day transfer through an intermediate city, for pairs with no
 *  direct data in any mode (e.g. Cinque Terre → Lugano via Milan). */
export interface LegVia {
  cityId: string;
  /** Mode for [origin → via, via → destination]. */
  modes: [TransportMode, TransportMode];
}

/** The journey between stop i and stop i+1. */
export interface Leg {
  mode: TransportMode;
  /** Manual user override of the auto-filled time, in minutes. */
  overrideMin?: number;
  /** Routed through an intermediate city; takes precedence over mode. */
  via?: LegVia;
}

export interface CityResult {
  cityId: string;
  cityName: string;
  /** Day-trip rows immediately follow their base city's row. */
  kind: 'stay' | 'daytrip';
  nights: number;
  /** For day trips this is the round trip (2× one-way, both overheads). */
  transitInMin: number;
  wakingHours: number;
  equivalentDays: number;
}

export interface ItineraryResult {
  perCity: CityResult[];
  totalWakingHours: number;
  totalTransitMin: number;
  totalNights: number;
}
