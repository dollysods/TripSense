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
import { MODE_OVERHEAD_MIN, formatMin, lookupTimeMin } from '../lib/calc';
import CityAutocomplete from './CityAutocomplete';
import TransportModeSelector from './TransportModeSelector';

interface Props {
  stops: Stop[];
  legs: Leg[];
  cities: CitiesDatabase;
  pairs: CityPairsDatabase;
  onStopsChange: (stops: Stop[]) => void;
  onLegsChange: (legs: Leg[]) => void;
}

function SortableStopRow(props: {
  stop: Stop;
  index: number;
  count: number;
  cities: CitiesDatabase;
  usedCityIds: Set<string>;
  onCity: (cityId: string | null) => void;
  onNights: (nights: number) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { stop, index, count } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? 'opacity-60 z-10 relative' : ''}`}
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
      <span className="w-6 text-center font-semibold text-slate-500">{index + 1}</span>
      <div className="flex-1 min-w-48">
        <CityAutocomplete
          cities={props.cities}
          value={stop.cityId}
          onChange={props.onCity}
          usedCityIds={props.usedCityIds}
        />
      </div>
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
    </div>
  );
}

function LegRow(props: {
  leg: Leg;
  origin: Stop;
  dest: Stop;
  pairs: CityPairsDatabase;
  onChange: (leg: Leg) => void;
}) {
  const { leg, origin, dest, pairs } = props;

  const ready = origin.cityId !== null && dest.cityId !== null;
  const unavailable = new Set<TransportMode>(
    ready
      ? TRANSPORT_MODES.filter(
          (m) => lookupTimeMin(pairs, origin.cityId!, dest.cityId!, m) === null,
        )
      : [],
  );
  const scheduled = ready ? lookupTimeMin(pairs, origin.cityId!, dest.cityId!, leg.mode) : null;
  const autoMin = scheduled === null ? null : scheduled + MODE_OVERHEAD_MIN[leg.mode];

  return (
    <div className="ml-10 flex flex-wrap items-center gap-3 py-1.5 text-sm text-slate-600">
      <span aria-hidden className="text-slate-300">│</span>
      <TransportModeSelector
        value={leg.mode}
        onChange={(mode) => props.onChange({ ...leg, mode, overrideMin: undefined })}
        unavailable={unavailable}
      />
      {leg.overrideMin !== undefined ? (
        <span className="font-medium text-amber-700">custom: {formatMin(leg.overrideMin)}</span>
      ) : autoMin !== null ? (
        <span>
          ≈ <span className="font-medium text-slate-800">{formatMin(autoMin)}</span>
          <span className="text-slate-400"> door-to-door</span>
        </span>
      ) : ready ? (
        <span className="text-rose-600">no {leg.mode} data — enter a time</span>
      ) : null}
      <label className="flex items-center gap-1.5">
        <span className="text-slate-400">override:</span>
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

  const moveStop = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    onStopsChange(arrayMove(stops, from, to));
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
    onLegsChange(legs.filter((_, i) => i !== legIndex));
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
                  origin={stops[i - 1]}
                  dest={stop}
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
                onCity={(cityId) => onStopsChange(stops.map((s, j) => (j === i ? { ...s, cityId } : s)))}
                onNights={(nights) => onStopsChange(stops.map((s, j) => (j === i ? { ...s, nights } : s)))}
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
