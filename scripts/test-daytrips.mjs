/**
 * Engine unit tests for the day-trip semantics (v1.1b), run against the
 * real bundled dataset. Bundles src/lib/calc.ts via esbuild first:
 *   node scripts/test-daytrips.mjs
 */
import { execSync } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = await mkdtemp(join(tmpdir(), 'tripsense-calc-'));
const bundle = join(tmp, 'calc.mjs');
execSync(`npx esbuild src/lib/calc.ts --bundle --format=esm --outfile=${bundle}`, { stdio: 'pipe' });
const calc = await import(bundle);

const cities = JSON.parse(await readFile('src/data/cities.json', 'utf8'));
const pairs = JSON.parse(await readFile('src/data/cityPairs.json', 'utf8'));

const t = (o, d) => pairs[`${o}_${d}`]?.modes?.train?.time_min ?? null;
const OVERHEAD_TRAIN = 20;

let failures = 0;
const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const stop = (id, cityId, nights, extra = {}) => ({ id, cityId, nights, ...extra });
const train = { mode: 'train' };

// ---- Scenario A: Munich -> Florence -> [Cinque Terre day trip] -> Rome ----
{
  const stops = [
    stop('s1', 'munich', 1),
    stop('s2', 'florence', 2),
    stop('s3', 'cinque_terre', 2, { kind: 'daytrip' }),
    stop('s4', 'rome', 2),
  ];
  const legs = [train, train, train];
  const r = calc.calcItinerary(stops, legs, cities, pairs);
  const [munich, florence, ct, rome] = r.perCity;

  check('A: 4 rows in order', r.perCity.length === 4 && ct.cityId === 'cinque_terre');
  check('A: CT row is a daytrip', ct.kind === 'daytrip' && ct.nights === 0);

  const ctOneWay = t('florence', 'cinque_terre') + OVERHEAD_TRAIN;
  check('A: CT transit is 2x one-way incl overhead', ct.transitInMin === 2 * ctOneWay,
    `${ct.transitInMin} vs ${2 * ctOneWay}`);

  const ctOnSite = Math.max(0, 16 - (2 * ctOneWay) / 60);
  check('A: CT on-site defaults to 16 - round trip', near(ct.wakingHours, ctOnSite),
    `${ct.wakingHours.toFixed(2)} vs ${ctOnSite.toFixed(2)}`);

  const florArrive = t('munich', 'florence') + OVERHEAD_TRAIN;
  const florExpected = Math.max(0, 2 * 16 - florArrive / 60 - (2 * ctOneWay) / 60 - ctOnSite);
  check('A: Florence pays arrival + day-trip round trip + on-site', near(florence.wakingHours, florExpected),
    `${florence.wakingHours.toFixed(2)} vs ${florExpected.toFixed(2)}`);

  const romeArrive = t('florence', 'rome') + OVERHEAD_TRAIN;
  check('A: leg after day trip departs from the BASE (Florence->Rome)', rome.transitInMin === romeArrive,
    `${rome.transitInMin} vs ${romeArrive} (CT->Rome would be ${t('cinque_terre', 'rome') + OVERHEAD_TRAIN})`);

  check('A: nights total ignores day trip', r.totalNights === 5);
  const sumTransit = munich.transitInMin + florence.transitInMin + ct.transitInMin + rome.transitInMin;
  check('A: total transit sums all rows incl round trip', r.totalTransitMin === sumTransit);
}

// ---- Scenario B: off-list day trip via override (Hallstatt from Salzburg) ----
{
  const stops = [
    stop('s1', 'munich', 1),
    stop('s2', 'salzburg', 2),
    stop('s3', null, 2, { kind: 'daytrip', customName: 'Hallstatt' }),
    stop('s4', 'prague', 2),
  ];
  const legs = [train, { mode: 'train', overrideMin: 120 }, train];
  const r = calc.calcItinerary(stops, legs, cities, pairs);
  const [, salzburg, hallstatt, prague] = r.perCity;

  check('B: custom stop appears with its name', hallstatt?.cityName === 'Hallstatt');
  check('B: override doubles for the round trip', hallstatt.transitInMin === 240,
    String(hallstatt.transitInMin));
  check('B: on-site = 16 - 4h', near(hallstatt.wakingHours, 12), hallstatt.wakingHours.toFixed(2));

  const przArrive = t('salzburg', 'prague') + OVERHEAD_TRAIN;
  check('B: Prague leg departs from Salzburg', prague.transitInMin === przArrive,
    `${prague.transitInMin} vs ${przArrive}`);

  const salzArrive = t('munich', 'salzburg') + OVERHEAD_TRAIN;
  const salzExpected = Math.max(0, 32 - salzArrive / 60 - 4 - 12);
  check('B: Salzburg charged 4h transit + 12h on site', near(salzburg.wakingHours, salzExpected),
    `${salzburg.wakingHours.toFixed(2)} vs ${salzExpected.toFixed(2)}`);
}

// ---- Scenario C: on-site override wins over the formula ----
{
  const stops = [
    stop('s1', 'vienna', 2),
    stop('s2', 'bratislava', 2, { kind: 'daytrip', onSiteHours: 6 }),
    stop('s3', 'budapest', 2),
  ];
  const r = calc.calcItinerary(stops, [train, train], cities, pairs);
  const [vienna, brat] = r.perCity;
  check('C: explicit on-site hours respected', brat.wakingHours === 6, String(brat.wakingHours));
  const rt = 2 * (t('vienna', 'bratislava') + OVERHEAD_TRAIN);
  check('C: Vienna charged rt + 6h', near(vienna.wakingHours, Math.max(0, 32 - rt / 60 - 6)),
    vienna.wakingHours.toFixed(2));
}

// ---- Scenario D: day trip without a base degrades to a stay ----
{
  const stops = [
    stop('s1', 'vienna', 2, { kind: 'daytrip' }),
    stop('s2', 'budapest', 2),
  ];
  const r = calc.calcItinerary(stops, [train], cities, pairs);
  check('D: first-stop day trip treated as stay', r.perCity[0].kind === 'stay' && r.perCity[0].nights === 2);
  check('D: nights counted normally', r.totalNights === 4);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll engine tests pass');
process.exit(failures ? 1 : 0);
