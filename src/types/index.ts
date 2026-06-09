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
}

export type CitiesDatabase = Record<string, City>;

/** One destination in the itinerary, in order. */
export interface Stop {
  /** Stable key for React lists / dnd-kit, not the city id. */
  id: string;
  cityId: string | null;
  nights: number;
}

/** The journey between stop i and stop i+1. */
export interface Leg {
  mode: TransportMode;
  /** Manual user override of the auto-filled time, in minutes. */
  overrideMin?: number;
}

export interface CityResult {
  cityId: string;
  cityName: string;
  nights: number;
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
