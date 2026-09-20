import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { CitiesDatabase, ItineraryResult } from '../types';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default marker icon resolves image URLs relative to the page
// (not the module), which breaks under a bundler — point it at the
// bundled asset URLs Vite gives these imports instead.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Props {
  result: ItineraryResult;
  cities: CitiesDatabase;
}

interface MappedStop {
  cityId: string;
  cityName: string;
  kind: 'stay' | 'daytrip';
  order: number;
  lat: number;
  lng: number;
}

/** Reframes the map whenever the set of points changes — the "auto-updating"
 *  behavior the plan asks for, no regenerate button needed. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    // The container can still report a stale (often zero) size right after
    // this lazy-loaded chunk mounts, which makes fitBounds compute a wildly
    // wrong zoom (it did — defaulted to z18, street level, instead of
    // framing the whole route). Force Leaflet to re-measure first.
    map.invalidateSize();
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

/** Route map for the current itinerary (Feature 2, v1.2). Off-list custom
 *  stops (e.g. Hallstatt typed in free-text) have no coordinates and are
 *  omitted from the map for this first cut, per the v1.2 plan. */
export default function RouteMap({ result, cities }: Props) {
  const stops = useMemo<MappedStop[]>(
    () =>
      result.perCity
        .map((c, i) => {
          const city = cities[c.cityId];
          if (!city) return null;
          return {
            cityId: c.cityId,
            cityName: c.cityName,
            kind: c.kind,
            order: i,
            lat: city.latitude,
            lng: city.longitude,
          };
        })
        .filter((s): s is MappedStop => s !== null),
    [result, cities],
  );

  const omittedCount = result.perCity.length - stops.length;

  // Day trips branch off as a spur rather than sitting inline on the main
  // route — the main line only ever connects consecutive stay rows.
  const mainRoute = useMemo<[number, number][]>(
    () => stops.filter((s) => s.kind === 'stay').map((s) => [s.lat, s.lng]),
    [stops],
  );

  const daytripSpurs = useMemo(() => {
    const spurs: { base: MappedStop; trip: MappedStop }[] = [];
    let lastStay: MappedStop | null = null;
    for (const s of stops) {
      if (s.kind === 'stay') {
        lastStay = s;
      } else if (lastStay) {
        spurs.push({ base: lastStay, trip: s });
      }
    }
    return spurs;
  }, [stops]);

  const allPoints = useMemo<[number, number][]>(() => stops.map((s) => [s.lat, s.lng]), [stops]);

  if (stops.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={allPoints[0]}
        zoom={6}
        scrollWheelZoom={false}
        className="h-80 w-full lg:h-96"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        <Polyline positions={mainRoute} pathOptions={{ color: '#4f46e5', weight: 3 }} />
        {daytripSpurs.map(({ base, trip }) => (
          <Polyline
            key={`spur-${trip.cityId}-${trip.order}`}
            positions={[
              [base.lat, base.lng],
              [trip.lat, trip.lng],
            ]}
            pathOptions={{ color: '#818cf8', weight: 2, dashArray: '6 6' }}
          />
        ))}
        {stops.map((s) => (
          <Marker key={`${s.cityId}-${s.order}`} position={[s.lat, s.lng]}>
            <Popup>
              {s.order + 1}. {s.cityName}
              {s.kind === 'daytrip' ? ' (day trip)' : ''}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {omittedCount > 0 && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          {omittedCount} off-list {omittedCount === 1 ? "stop isn't" : "stops aren't"} shown — no
          coordinates for custom destinations yet.
        </p>
      )}
    </div>
  );
}
