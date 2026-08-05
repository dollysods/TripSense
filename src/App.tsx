import { useMemo, useState } from 'react';
import type { CitiesDatabase, CityPairsDatabase, Leg, Stop } from './types';
import { calcItinerary } from './lib/calc';
import ItineraryBuilder from './components/ItineraryBuilder';
import ResultsDisplay from './components/ResultsDisplay';
import ExportButtons from './components/ExportButtons';
import citiesJson from './data/cities.json';
import cityPairsJson from './data/cityPairs.json';
import dataMeta from './data/meta.json';
import { Analytics } from "@vercel/analytics/react";

const cities = citiesJson as CitiesDatabase;
const cityPairs = cityPairsJson as unknown as CityPairsDatabase;

export default function App() {
  const [stops, setStops] = useState<Stop[]>([
    { id: 'stop-1', cityId: null, nights: 2 },
    { id: 'stop-2', cityId: null, nights: 2 },
  ]);
  const [legs, setLegs] = useState<Leg[]>([{ mode: 'train' }]);

  const result = useMemo(
    () => calcItinerary(stops, legs, cities, cityPairs),
    [stops, legs],
  );

  const ready = result.perCity.length >= 2;

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
     <Analytics />

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Your itinerary</h2>
          <ItineraryBuilder
            stops={stops}
            legs={legs}
            cities={cities}
            pairs={cityPairs}
            onStopsChange={setStops}
            onLegsChange={setLegs}
          />
        </section>

        {ready && (
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
