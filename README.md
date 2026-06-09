# TripSense

See how much of your trip you'll actually be awake **in** each city — not just how many nights you booked.

Live at [maketripsense.com](https://maketripsense.com). Project documentation and decisions live in Notion (single source of truth).

## How it works

Fully static client-side app: no backend, no accounts, no tracking of itineraries. You pick cities and transport modes; TripSense computes per-city waking hours (`nights × 16h − transit into the city`) from a bundled dataset of typical European travel times, and exports the result as a PDF or shareable image card.

## Stack

React + Vite + TypeScript, Tailwind CSS v4, react-select, dnd-kit, @react-pdf/renderer + html-to-image (both lazy-loaded on export click).

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
node scripts/validate-data.mjs   # data gate (also runs in CI)
```

## Data

`src/data/` holds the slim production dataset (`cityPairs.json`: time + direct flag per mode per city pair, `cities.json`, `meta.json` with the data version shown in the footer). It is generated — do not edit by hand. The extraction/estimation pipeline lives in `tripsense-data/db-extract/` (separate from this repo):

- **Train:** extracted via [Transitous](https://transitous.org) (community MOTIS routing over open GTFS feeds); originally via db-vendo-client until DB blocked third-party clients (Feb 2026).
- **Plane:** estimated from great-circle distance with a calibrated block-time model (±15 min typical).
- **Bus/Car:** see pipeline scripts.

Regenerate with `node 05-consolidate.js --out <this repo>/src/data`, then re-run the validator.

## Attribution

Travel data via open GTFS feeds from Deutsche Bahn, ÖBB, SNCF, Eurostar, Trenitalia and other European operators, routed by [Transitous](https://transitous.org). Built with [db-vendo-client](https://github.com/public-transport/db-vendo-client) (MIT) during initial extraction.
