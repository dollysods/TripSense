import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CitiesDatabase, CityPairsDatabase, Leg, Stop, TransportMode } from '../types';
import { TRANSPORT_MODES } from '../types';
import {
  MODE_OVERHEAD_MIN,
  bestVia,
  formatMin,
  isPlaced,
  lookupTimeMin,
  stopDisplayName,
  viaLegMin,
} from '../lib/calc';
import CityAutocomplete from './CityAutocomplete';
import TransportModeSelector, { MODE_META } from './TransportModeSelector';

interface Props {
  stops: Stop[];
  legs: Leg[];
  cities: CitiesDatabase;
  pairs: CityPairsDatabase;
  onStopsChange: (stops: Stop[]) => void;
  onLegsChange: (legs: Leg[]) => void;
}

/** Round trips longer than this get a "consider staying overnight" nudge. */
const LONG_ROUND_TRIP_MIN = 600;

/** Nearest stop before index i that isn't a day trip — where the
 *  traveler actually departs from for the leg into stops[i]. */
function effectiveOrigin(stops: Stop[], i: number): Stop | undefined {
  for (let j = i - 1; j >= 0; j--) {
    if (stops[j].kind !== 'daytrip') return stops[j];
  }
  return stops[i - 1];
}

function SortableStopRow(props: {
  stop: Stop;
  index: number;
  count: number;
  cities: CitiesDatabase;
  usedCityIds: Set<string>;
  baseName: string | null;
  daytripIssue: string | null;
  onCity: (cityId: string | null, customName?: string) => void;
  onNights: (nights: number) => void;
  onKind: (kind: 'stay' | 'daytrip') => void;
  onOnSiteHours: (hours: number | undefined) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { stop, index, count } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const isDaytrip = stop.kind === 'daytrip';
  // A day trip needs a base before it and shouldn't end the trip.
  const toggleDisabled = !isDaytrip && (index === 0 || index === count - 1);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm ${
        isDaytrip ? 'ml-10 border-indigo-200 border-l-4' : 'border-slate-200'
      } ${isDragging ? 'opacity-60 z-10 relative' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 hover:text-slate-600 px-1 touch-none"
        aria-label={`Drag to reorder stop ${index + 1}`}
        title="Drag to reorder"
      >
        ⠿
      </button>
      <span className="w-6 text-center font-semibold text-slate-500">
        {isDaytrip ? '↳' : index + 1}
      </span>
      <div className="flex-1 min-w-48">
        <CityAutocomplete
          cities={props.cities}
          value={stop.cityId}
          customValue={stop.customName}
          onChange={props.onCity}
          usedCityIds={props.usedCityIds}
        />
      </div>

      <label
        className={`flex items-center gap-1.5 text-sm ${
          toggleDisabled ? 'text-slate-300' : 'text-slate-600'
        }`}
        title={
          toggleDisabled
            ? 'A day trip needs a base city before it and can’t be the last stop'
            : `Same-day round trip${props.baseName ? ` from ${props.baseName}` : ''} — nights stay with the base city`
        }
      >
        <input
          type="checkbox"
          checked={isDaytrip}
          disabled={toggleDisabled}
          onChange={(e) => props.onKind(e.target.checked ? 'daytrip' : 'stay')}
          className="accent-indigo-600"
        />
        day trip{isDaytrip && props.baseName ? ` from ${props.baseName}` : ''}
      </label>

      {isDaytrip ? (
        <label className="flex items-center gap-1.5 text-sm text-slate-600" title="Hours spent at the destination. Default: 16 − round-trip transit.">
          <input
            type="number"
            min={0}
            max={16}
            step={0.5}
            placeholder="auto"
            value={stop.onSiteHours ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              props.onOnSiteHours(v === '' ? undefined : Math.max(0, Math.min(16, Number(v))));
            }}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-right"
            aria-label={`Hours on site for stop ${index + 1}`}
          />
          h on site
        </label>
      ) : (
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="number"
            min={1}
            max={30}
            value={stop.nights}
            onChange={(e) => props.onNights(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-right"
            aria-label={`Nights in stop ${index + 1}`}
          />
          nights
        </label>
      )}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => props.onMove(-1)}
          disabled={index === 0}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label={`Move stop ${index + 1} up`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => props.onMove(1)}
          disabled={index === count - 1}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label={`Move stop ${index + 1} down`}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={props.onRemove}
          disabled={count <= 2}
          className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
          aria-label={`Remove stop ${index + 1}`}
          title={count <= 2 ? 'An itinerary needs at least two cities' : 'Remove city'}
        >
          ✕
        </button>
      </div>

      {props.daytripIssue && (
        <p className="w-full text-xs text-amber-700">⚠ {props.daytripIssue}</p>
      )}
    </div>
  );
}

function LegRow(props: {
  leg: Leg;
  origin: Stop;
  dest: Stop;
  destIsDaytrip: boolean;
  cities: CitiesDatabase;
  pairs: CityPairsDatabase;
  onChange: (leg: Leg) => void;
}) {
  const { leg, origin, dest, destIsDaytrip, cities, pairs } = props;

  const bothPlaced = isPlaced(origin) && isPlaced(dest);
  // Dataset lookups need dataset cities on both ends; an off-list stop
  // always goes through the override path.
  const ready = origin.cityId !== null && dest.cityId !== null;
  const offList = bothPlaced && !ready;

  const unavailable = new Set<TransportMode>(
    ready
      ? TRANSPORT_MODES.filter(
          (m) => lookupTimeMin(pairs, origin.cityId!, dest.cityId!, m) === null,
        )
      : [],
  );

  // Pairs with no direct data in any mode (no-airport gateway cities
  // against sea-locked/rail-isolated partners): offer the best
  // single-transfer routing instead of a dead end.
  const allUnavailable = ready && unavailable.size === TRANSPORT_MODES.length;
  const suggestion =
    allUnavailable && !leg.via && leg.overrideMin === undefined
      ? bestVia(pairs, cities, origin.cityId!, dest.cityId!)
      : null;

  const scheduled = ready ? lookupTimeMin(pairs, origin.cityId!, dest.cityId!, leg.mode) : null;
  const oneWayMin =
    leg.overrideMin !== undefined
      ? leg.overrideMin
      : ready && leg.via
        ? viaLegMin(pairs, origin.cityId!, dest.cityId!, leg.via)
        : scheduled === null
          ? null
          : scheduled + MODE_OVERHEAD_MIN[leg.mode];
  const shownMin = oneWayMin === null ? null : destIsDaytrip ? oneWayMin * 2 : oneWayMin;
  const longRoundTrip = destIsDaytrip && shownMin !== null && shownMin > LONG_ROUND_TRIP_MIN;

  return (
    <div className="ml-10 flex flex-wrap items-center gap-3 py-1.5 text-sm text-slate-600">
      <span aria-hidden className="text-slate-300">│</span>
      {leg.via ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-indigo-800">
          <span aria-hidden>{MODE_META[leg.via.modes[0]].icon}</span>
          <span>
            via <span className="font-medium">{cities[leg.via.cityId]?.name ?? leg.via.cityId}</span>
          </span>
          <span aria-hidden>{MODE_META[leg.via.modes[1]].icon}</span>
          <button
            type="button"
            onClick={() => props.onChange({ ...leg, via: undefined })}
            className="ml-1 text-indigo-400 hover:text-indigo-700"
            aria-label="Remove via routing"
            title="Remove via routing"
          >
            ✕
          </button>
        </span>
      ) : (
        <TransportModeSelector
          value={leg.mode}
          onChange={(mode) => props.onChange({ ...leg, mode, overrideMin: undefined })}
          unavailable={unavailable}
        />
      )}
      {leg.overrideMin !== undefined ? (
        <span className="font-medium text-amber-700">
          custom: {formatMin(shownMin ?? leg.overrideMin)}
          {destIsDaytrip && <span className="font-normal text-slate-500"> ×2 round trip</span>}
        </span>
      ) : shownMin !== null ? (
        <span>
          ≈ <span className="font-medium text-slate-800">{formatMin(shownMin)}</span>
          {destIsDaytrip ? (
            <span className="text-slate-400"> round trip, door-to-door</span>
          ) : (
            <span className="text-slate-400"> door-to-door</span>
          )}
          {leg.via && <span className="text-slate-400"> incl. transfer</span>}
        </span>
      ) : suggestion ? (
        <span className="flex items-center gap-2">
          <span className="text-slate-500">no direct option in our data —</span>
          <button
            type="button"
            onClick={() =>
              props.onChange({ ...leg, via: { cityId: suggestion.cityId, modes: suggestion.modes } })
            }
            className="rounded-lg border border-indigo-300 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
          >
            route via {cities[suggestion.cityId]?.name ?? suggestion.cityId} ≈ {formatMin(suggestion.totalMin)}
          </button>
        </span>
      ) : offList ? (
        <span className="text-rose-600">off-list place — enter a one-way time</span>
      ) : ready ? (
        <span className="text-rose-600">no {leg.mode} data — enter a time</span>
      ) : null}
      {longRoundTrip && (
        <span className="text-amber-700">
          ⚠ long round trip — consider staying overnight instead
        </span>
      )}
      <label className="flex items-center gap-1.5">
        <span className="text-slate-400">override{destIsDaytrip ? ' (one-way)' : ''}:</span>
        <input
          type="number"
          min={0}
          step={5}
          placeholder="min"
          value={leg.overrideMin ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            props.onChange({ ...leg, overrideMin: v === '' ? undefined : Math.max(0, Number(v)) });
          }}
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
          aria-label="Override travel time in minutes"
        />
      </label>
    </div>
  );
}

let nextStopId = 100;

export default function ItineraryBuilder({ stops, legs, cities, pairs, onStopsChange, onLegsChange }: Props) {
  const usedCityIds = new Set(stops.map((s) => s.cityId).filter((c): c is string => c !== null));

  // A via routing is chosen for one specific city pair; whenever a leg's
  // endpoints change (city edit, reorder, removal) it must be dropped or
  // it would silently price a route through an irrelevant city.
  const clearVias = (affected: (legIndex: number) => boolean) =>
    legs.map((l, j) => (affected(j) && l.via ? { ...l, via: undefined } : l));

  const moveStop = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    onStopsChange(arrayMove(stops, from, to));
    onLegsChange(clearVias(() => true));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = stops.findIndex((s) => s.id === active.id);
      const to = stops.findIndex((s) => s.id === over.id);
      moveStop(from, to);
    }
  };

  const addStop = () => {
    onStopsChange([...stops, { id: `stop-${nextStopId++}`, cityId: null, nights: 2 }]);
    onLegsChange([...legs, { mode: 'train' }]);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    const nextStops = stops.filter((_, i) => i !== index);
    // Legs sit between stops: removing stop i removes the leg arriving
    // into it (leg i-1), except for the first stop where leg 0 goes.
    const legIndex = Math.max(0, index - 1);
    onStopsChange(nextStops);
    // The leg that now bridges the gap spans a new pair — drop its via.
    onLegsChange(
      legs
        .filter((_, i) => i !== legIndex)
        .map((l, i2) => (i2 === legIndex && l.via ? { ...l, via: undefined } : l)),
    );
  };

  const hasBaseBefore = (i: number) =>
    stops.slice(0, i).some((s) => s.kind !== 'daytrip' && isPlaced(s));

  /** Reorder/removal can strand a day trip in an invalid spot; the
   *  engine degrades gracefully, but tell the user what's happening. */
  const daytripIssue = (stop: Stop, i: number): string | null => {
    if (stop.kind !== 'daytrip') return null;
    if (!hasBaseBefore(i)) return 'day trips need a base city before them — treated as a regular stay for now';
    if (i === stops.length - 1) return 'a day trip can’t end the trip — add your final city after it';
    return null;
  };

  const baseNameFor = (i: number): string | null => {
    for (let j = i - 1; j >= 0; j--) {
      if (stops[j].kind !== 'daytrip' && isPlaced(stops[j])) return stopDisplayName(stops[j], cities);
    }
    return null;
  };

  return (
    <div className="space-y-1">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stops.map((stop, i) => (
            <div key={stop.id}>
              {i > 0 && (
                <LegRow
                  leg={legs[i - 1] ?? { mode: 'train' }}
                  origin={effectiveOrigin(stops, i) ?? stops[i - 1]}
                  dest={stop}
                  destIsDaytrip={stop.kind === 'daytrip' && hasBaseBefore(i)}
                  cities={cities}
                  pairs={pairs}
                  onChange={(leg) => onLegsChange(legs.map((l, j) => (j === i - 1 ? leg : l)))}
                />
              )}
              <SortableStopRow
                stop={stop}
                index={i}
                count={stops.length}
                cities={cities}
                usedCityIds={usedCityIds}
                baseName={baseNameFor(i)}
                daytripIssue={daytripIssue(stop, i)}
                onCity={(cityId, customName) => {
                  onStopsChange(
                    stops.map((s, j) =>
                      j === i ? { ...s, cityId, customName: customName?.trim() || undefined } : s,
                    ),
                  );
                  onLegsChange(clearVias((j) => j === i - 1 || j === i));
                }}
                onNights={(nights) => onStopsChange(stops.map((s, j) => (j === i ? { ...s, nights } : s)))}
                onKind={(kind) =>
                  onStopsChange(
                    stops.map((s, j) =>
                      j === i ? { ...s, kind, onSiteHours: undefined } : s,
                    ),
                  )
                }
                onOnSiteHours={(onSiteHours) =>
                  onStopsChange(stops.map((s, j) => (j === i ? { ...s, onSiteHours } : s)))
                }
                onRemove={() => removeStop(i)}
                onMove={(dir) => moveStop(i, i + dir)}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addStop}
        className="mt-3 rounded-lg border border-dashed border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
      >
        + Add city
      </button>
    </div>
  );
}
