import { forwardRef } from 'react';
import type { ItineraryResult } from '../types';
import { WAKING_HOURS_PER_DAY, formatHours, formatMin } from '../lib/calc';

interface Props {
  result: ItineraryResult;
}

/**
 * 1200x630 social-share card (Open Graph dimensions). Rendered
 * offscreen and rasterized by html-to-image. Inline styles only —
 * html-to-image serializes computed styles, and fixed pixel sizing
 * must not depend on viewport-relative Tailwind utilities.
 */
const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard({ result }, ref) {
  // Day trips fold into their base city's line and tile.
  const groups: { base: ItineraryResult['perCity'][number]; trips: ItineraryResult['perCity'] }[] = [];
  for (const c of result.perCity) {
    if (c.kind === 'daytrip' && groups.length > 0) groups[groups.length - 1].trips.push(c);
    else groups.push({ base: c, trips: [] });
  }

  const route = groups
    .map((g) =>
      g.trips.length
        ? `${g.base.cityName} + ${g.trips.map((t) => `${t.cityName} day trip`).join(' + ')}`
        : g.base.cityName,
    )
    .join(' → ');

  return (
    <div
      ref={ref}
      style={{
        width: 1200,
        height: 630,
        background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 60%, #6366f1 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 56,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.9 }}>🚆 TripSense</div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 18, lineHeight: 1.25 }}>{route}</div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {groups.map((g, i) => (
          <div
            key={`${g.base.cityId}-${i}`}
            style={{
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 16,
              padding: '18px 24px',
              minWidth: 150,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>{g.base.cityName}</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>
              {formatHours(g.base.wakingHours)}
            </div>
            <div style={{ fontSize: 18, opacity: 0.75 }}>awake · {g.base.nights} nights</div>
            {g.trips.map((t, j) => (
              <div key={`${t.cityId}-${j}`} style={{ fontSize: 17, opacity: 0.85, marginTop: 6 }}>
                ↳ {t.cityName} · {formatHours(t.wakingHours)} day trip
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 26 }}>
          <span style={{ fontWeight: 800 }}>{formatHours(result.totalWakingHours)}</span>
          <span style={{ opacity: 0.8 }}> awake · </span>
          <span style={{ fontWeight: 800, color: '#fca5a5' }}>{formatMin(result.totalTransitMin)}</span>
          <span style={{ opacity: 0.8 }}> in transit · </span>
          <span style={{ fontWeight: 800 }}>
            {(result.totalWakingHours / WAKING_HOURS_PER_DAY).toFixed(1)} full days
          </span>
        </div>
        <div style={{ fontSize: 20, opacity: 0.7 }}>maketripsense.com</div>
      </div>
    </div>
  );
});

export default ShareCard;
