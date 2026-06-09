import Select from 'react-select';
import type { CitiesDatabase } from '../types';

interface Option {
  value: string;
  label: string;
}

interface Props {
  cities: CitiesDatabase;
  value: string | null;
  onChange: (cityId: string | null) => void;
  /** City ids already used elsewhere in the itinerary (still selectable — revisits are legal — but shown last). */
  usedCityIds?: Set<string>;
}

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', CH: 'Switzerland', CZ: 'Czechia',
  DE: 'Germany', ES: 'Spain', FR: 'France', GB: 'United Kingdom',
  GR: 'Greece', HR: 'Croatia', HU: 'Hungary', IE: 'Ireland',
  IT: 'Italy', NL: 'Netherlands', PL: 'Poland', PT: 'Portugal',
};

export default function CityAutocomplete({ cities, value, onChange, usedCityIds }: Props) {
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

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Select<Option>
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? null)}
      placeholder="Choose a city…"
      isClearable
      className="min-w-56"
      classNamePrefix="city-select"
      aria-label="City"
    />
  );
}
