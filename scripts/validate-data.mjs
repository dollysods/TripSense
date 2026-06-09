/**
 * CI data gate: validates the bundled production dataset. Runs in CI
 * before every build so a bad data refresh can never reach production.
 * Exit code 1 on any failure.
 */
import { readFile } from 'node:fs/promises';

const MAX_MIN = { train: 2400, plane: 600, bus: 2400, car: 2400 };
const MODES = Object.keys(MAX_MIN);

const cities = JSON.parse(await readFile('src/data/cities.json', 'utf8'));
const pairs = JSON.parse(await readFile('src/data/cityPairs.json', 'utf8'));
const meta = JSON.parse(await readFile('src/data/meta.json', 'utf8'));

let failures = 0;
const fail = (msg) => { console.error(`FAIL: ${msg}`); failures++; };

const cityIds = new Set(Object.keys(cities));
if (cityIds.size < 20) fail(`only ${cityIds.size} cities — expected 20+`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.dataVersion)) fail('meta.dataVersion missing or malformed');

for (const [id, city] of Object.entries(cities)) {
  if (!city.name || !city.country) fail(`city ${id}: missing name/country`);
  if (typeof city.latitude !== 'number' || typeof city.longitude !== 'number') {
    fail(`city ${id}: missing coordinates`);
  }
}

let withTrain = 0;
for (const [key, pair] of Object.entries(pairs)) {
  const [origin, dest] = key.split('_');
  if (!cityIds.has(origin) || !cityIds.has(dest)) fail(`${key}: unknown city id`);
  if (!pair.modes || Object.keys(pair.modes).length === 0) fail(`${key}: no modes object`);
  let usable = 0;
  for (const [mode, data] of Object.entries(pair.modes ?? {})) {
    if (!MODES.includes(mode)) fail(`${key}: unknown mode ${mode}`);
    if (data === null) continue;
    usable++;
    if (!Number.isFinite(data.time_min) || data.time_min <= 0) fail(`${key}/${mode}: bad time_min`);
    if (data.time_min > MAX_MIN[mode]) fail(`${key}/${mode}: time_min ${data.time_min} > ${MAX_MIN[mode]}`);
    if (typeof data.direct !== 'boolean') fail(`${key}/${mode}: missing direct flag`);
    if (mode === 'train') withTrain++;
  }
  if (usable === 0) fail(`${key}: no usable mode`);
}

// Coverage floor: regressions in the extraction pipeline show up here.
if (withTrain < 350) fail(`only ${withTrain} pairs with train data — expected 350+`);
if (Object.keys(pairs).length < 550) fail(`only ${Object.keys(pairs).length} pairs — expected 550+`);

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log(`Data OK: ${Object.keys(pairs).length} pairs, ${cityIds.size} cities, version ${meta.dataVersion}.`);
