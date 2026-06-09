import type { TransportMode } from '../types';
import { TRANSPORT_MODES } from '../types';

const MODE_META: Record<TransportMode, { label: string; icon: string }> = {
  train: { label: 'Train', icon: '🚆' },
  plane: { label: 'Plane', icon: '✈️' },
  bus: { label: 'Bus', icon: '🚌' },
  car: { label: 'Car', icon: '🚗' },
};

interface Props {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
  /** Modes with no data for this pair, rendered disabled. */
  unavailable?: Set<TransportMode>;
}

export default function TransportModeSelector({ value, onChange, unavailable }: Props) {
  return (
    <div role="radiogroup" aria-label="Transport mode" className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
      {TRANSPORT_MODES.map((mode) => {
        const disabled = unavailable?.has(mode) ?? false;
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
            title={disabled ? `No ${mode} option for this route` : MODE_META[mode].label}
            className={[
              'px-2.5 py-1.5 text-sm flex items-center gap-1 transition-colors',
              active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100',
              disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <span aria-hidden>{MODE_META[mode].icon}</span>
            <span className="hidden sm:inline">{MODE_META[mode].label}</span>
          </button>
        );
      })}
    </div>
  );
}
