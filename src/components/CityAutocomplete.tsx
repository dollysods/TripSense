import CreatableSelect from 'react-select/creatable';
import type { CitiesDatabase } from '../types';

interface Option {
  value: string;
  label: string;
  /** Set for the free-text option representing an off-list place. */
  custom?: boolean;
}

interface Props {
  cities: CitiesDatabase;
  value: string | null;
  /** Off-list place name, shown when value is null. */
  customValue?: string;
  /** cityId for dataset cities; (null, name) for off-list places. */
  onChange: (cityId: string | null, customName?: string) => void;
  /** City ids already used elsewhere in the itinerary (still selectable — revisits are legal — but shown last). */
  usedCityIds?: Set<string>;
}

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', CH: 'Switzerland', CY: 'Cyprus',
  CZ: 'Czechia', DE: 'Germany', ES: 'Spain', FR: 'France',
  GB: 'United Kingdom', GR: 'Greece', HR: 'Croatia', HU: 'Hungary',
  IE: 'Ireland', IT: 'Italy', LI: 'Liechtenstein', LU: 'Luxembourg',
  MT: 'Malta', NL: 'Netherlands', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', SI: 'Slovenia', SK: 'Slovakia',
};

const CUSTOM = '__custom__';

export default function CityAutocomplete({ cities, value, customValue, onChange, usedCityIds }: Props) {
  const options: Option[] = Object.entries(cities)
    .map(([id, city]) => ({
      value: id,
      label: `${city.name}, ${COUNTRY_NAMES[city.country] ?? city.country}`,
    }))
    .sort((a, b) => {
      const aUsed = usedCityIds?.has(a.value) ? 1 : 0;
      const bUsed = usedCityIds?.has(b.value) ? 1 : 0;
      return aUsed - bUsed || a.label.localeCompare(b.label);
    });

  const selected: Option | null = value
    ? options.find((o) => o.value === value) ?? null
    : customValue
      ? { value: CUSTOM, label: `${customValue} (off-list)`, custom: true }
      : null;

  return (
    <CreatableSelect<Option>
      options={options}
      value={selected}
      onChange={(opt) => {
        if (!opt) return onChange(null);
        if (opt.custom || opt.value === CUSTOM) return; // no-op reselect
        onChange(opt.value);
      }}
      onCreateOption={(input) => {
        const name = input.trim();
        if (name) onChange(null, name);
      }}
      formatCreateLabel={(input) => `Add "${input}" — off-list place, you'll enter travel times manually`}
      placeholder="Choose a city…"
      isClearable
      className="min-w-56"
      classNamePrefix="city-select"
      aria-label="City"
    />
  );
}
