# India Family Planning Atlas — District Level (NFHS-5)

An interactive, mobile-first, dark neon-glow map of oral contraceptive pill
use across 652 real Indian districts, built on real NFHS-5 data.

## ⚠️ Read this before you publish it as "i-Pill" data

There is **no published NFHS indicator for emergency contraceptive
("i-Pill") usage** at any level. NFHS-5 tracks *current use of the regular
daily oral contraceptive pill* ("Pill") as part of its family planning
method mix — that is what this app uses, honestly labeled as **"Oral
Contraceptive Pill use"**, not "i-Pill." If your audience needs
emergency-contraceptive-specific numbers, they don't exist in NFHS at any
granularity — that would require a different data source entirely (e.g.
retail/pharmacy sales data).

**Source:** National Family Health Survey-5 (2019–21) District Factsheets,
International Institute for Population Sciences / Ministry of Health &
Family Welfare, Government of India. Extracted via the public dataset
[jvargh7/nfhs5_factsheets](https://github.com/jvargh7/nfhs5_factsheets),
indicator "25. Pill (%)".

## Coverage: 652 of 705 districts (92.5%)

District boundaries come from a community-maintained shapefile
([datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES))
that doesn't perfectly line up with NFHS-5's district list — India's
district boundaries change often (splits, renames). Names are matched by
normalization + fuzzy matching (Dice coefficient, threshold 0.6, same
state only). Every match and every miss is logged, not hidden:

- `public/data/match-report.json` — full match/miss audit trail
- Known unmatched clusters: Sikkim (redistricted from 4→6 districts after
  the survey), several Karnataka districts (source shapefile has garbled
  Kannada-diacritic names), Delhi is now fixed via a state-name alias,
  a handful of renamed districts (Gulbarga→Kalaburagi, Bangalore→Bengaluru,
  Aurangabad→Chhatrapati Sambhajinagar, etc.)

If you need 100%, the fix is sourcing a newer, cleaner district shapefile
and re-running `npm run build:data` — the matching logic in
`scripts/build-data.mjs` doesn't need to change, just the input file.

**Map dots:** dot *count* per district is real (proportional to the Pill
value). Dot *position* within a district is randomly generated for visual
texture only — it does not represent real household locations.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · MapLibre GL JS ·
Recharts · Framer Motion · Fuse.js

No basemap tiles or API keys — the map renders its own district polygons
on a flat dark background (zero-config, no Mapbox/MapTiler key needed).
The Inter font loads from Google Fonts at build time (works fine on
Vercel; if you build somewhere with no internet access, swap it for a
system font stack in `app/layout.tsx`).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Data pipeline

Raw source files live in `raw-data/`. Regenerate everything with:

```bash
npm run build:data
```

Outputs to `public/data/`:
- `districts.geojson` — 652 district boundaries + Pill value (NFHS-5 &
  NFHS-4) + bbox, each with a unique `uid` ("State|District")
- `dots/pill.geojson` — ~11.8K precomputed glow-dot points
- `meta.json` — national average / highest / lowest district / ranks
- `state_leaderboard.json` — state averages across matched districts
  (drives the "Top 5 states" card)
- `match-report.json` — full name-matching audit trail
- `indicators.json` — indicator catalogue (currently just Pill)

## Adding more indicators (anaemia, hypertension, diabetes, other FP methods)

1. Add the indicator string (as it appears in
   `raw-data/nfhs5_districts_raw.csv`'s `Indicator` column) to
   `scripts/build-data.mjs`.
2. Re-run `npm run build:data` — it'll produce a new `dots/<key>.geojson`
   and add the indicator to `meta.json` / `indicators.json`.
3. No component changes needed: the indicator dropdown in `FilterPanel`
   auto-appears once `indicators.json` has more than one entry.

`scripts/build-data-states.mjs` is kept for reference — it's the original
state-level (36 states/UTs), multi-indicator (7 family-planning methods)
version of this pipeline, in case you want a coarser but broader view
alongside the district-level Pill map.

## Deploying

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel — no environment variables or API keys
   needed.
3. Vercel runs `npm run build` automatically. `public/data/*` is already
   committed, so you don't need to re-run `build:data` at deploy time
   unless you change the source data.

## Project structure

```
app/                     Next.js App Router pages, layout, global styles
components/
  Map/                    MapLibre map, hover tooltip, legend
  Panel/                  District detail side panel / bottom sheet content
  Search/                 Fuzzy district/state search bar
  Filters/                Region / prevalence-range filter panel
  Stats/                  National summary cards + top-states leaderboard
  UI/                     Shared UI (bottom sheet)
lib/                      Types, region mapping, data-fetching hooks
raw-data/                 Source NFHS-5 extracts + raw boundary files
scripts/
  build-data.mjs           District-level pipeline (current, primary)
  build-data-states.mjs     State-level pipeline (reference/legacy)
public/data/               Generated output consumed by the client
```
