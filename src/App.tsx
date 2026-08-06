import { useEffect, useMemo, useState } from 'react';
import type { CitiesDatabase, CityPairsDatabase, Leg, Stop } from './types';
import { calcItinerary } from './lib/calc';
import ItineraryBuilder from './components/ItineraryBuilder';
import ResultsDisplay from './components/ResultsDisplay';
import ExportButtons from './components/ExportButtons';
import citiesJson from './data/cities.json';
import dataMeta from './data/meta.json';
import { Analytics } from "@vercel/analytics/react";

const cities = citiesJson as CitiesDatabase;

// cityPairs.json is fetched at runtime instead of bundled (v1.1c): at
// 64 cities it's ~550 KB raw, which as a static import gets inlined
// into the JS bundle and blocks the main thread parsing it before
// first paint. Serving it from public/ and fetching after mount keeps
// the <3s load criterion intact as the dataset grows (Production Plan
// C2 anticipated this exact threshold).
export default function App() {
  const [stops, setStops] = useState<Stop[]>([
    { id: 'stop-1', cityId: null, nights: 2 },
    { id: 'stop-2', cityId: null, nights: 2 },
  ]);
  const [legs, setLegs] = useState<Leg[]>([{ mode: 'train' }]);
  const [cityPairs, setCityPairs] = useState<CityPairsDatabase | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/cityPairs.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: CityPairsDatabase) => setCityPairs(data))
      .catch(() => setLoadError(true));
  }, []);

  const result = useMemo(
    () => (cityPairs ? calcItinerary(stops, legs, cities, cityPairs) : null),
    [stops, legs, cityPairs],
  );

  const ready = result !== null && result.perCity.length >= 2;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <h1 className="text-2xl font-bold text-slate-900">
            🚆 TripSense
          </h1>
          <p className="mt-1 text-slate-500">
            See how much of your trip you'll actually be awake <em>in</em> each city —
            not just how many nights you booked.
          </p>
        </div>
      </header>
      {/* mode="production" is required on Vite - unlike webpack/Next, Vite
          doesn't define process.env.NODE_ENV in client code, so the
          package's auto-detection silently no-ops without this override. */}
      <Analytics mode="production" />

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Your itinerary</h2>
          {cityPairs ? (
            <ItineraryBuilder
              stops={stops}
              legs={legs}
              cities={cities}
              pairs={cityPairs}
              onStopsChange={setStops}
              onLegsChange={setLegs}
            />
          ) : loadError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Couldn't load route data. Please refresh the page.
            </p>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
              Loading route data…
            </p>
          )}
        </section>

        {ready && result && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Your real time budget</h2>
              <ExportButtons result={result} />
            </div>
            <ResultsDisplay result={result} />
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 text-xs text-slate-400">
        <p>
          Train times via open European GTFS data routed by{' '}
          <a className="underline" href="https://transitous.org">Transitous</a> and Deutsche Bahn,
          ÖBB, SNCF, Eurostar, Trenitalia and other operators. Built with{' '}
          <a className="underline" href="https://github.com/public-transport/db-vendo-client">db-vendo-client</a> (MIT).
          Schedule data version {dataMeta.dataVersion}. Times are estimates, not guarantees.
        </p>
      </footer>
    </div>
  );
}
