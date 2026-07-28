# India Family Planning Method-Use Atlas

An interactive, mobile-first, dark-themed map of contraceptive method use
across India's states and union territories, built on real NFHS-5 data.

## ⚠️ Read this before you publish it as "i-Pill" data

There is **no published NFHS indicator for emergency contraceptive
("i-Pill") usage** at state or district level. NFHS-5 tracks *current use of
the regular daily oral contraceptive pill* ("Pill") as part of its family
planning method mix — that is what this app uses by default, honestly
labeled as **"Oral Contraceptive Pill use"**, not "i-Pill." If you need
emergency-contraceptive-specific numbers, they don't exist in NFHS at this
granularity; you'd need a different data source (e.g. retail/pharmacy sales
data, which NFHS does not collect).

Six other real, sourced NFHS-5 family planning indicators are included and
switchable from the Indicator dropdown: any modern method, any method,
female sterilization, condom, IUD/PPIUD, injectables.

**Source:** National Family Health Survey-5 (2019–21), International
Institute for Population Sciences / Ministry of Health & Family Welfare,
Government of India. Extracted via the public dataset
[jvargh7/nfhs5_factsheets](https://github.com/jvargh7/nfhs5_factsheets).

**Granularity:** State/UT level (36 regions), not district level. NFHS-5
does publish some indicators at district level, but assembling and
validating ~766 district boundaries + matching district-level family
planning figures is a separate, much larger effort — see "Adding district
data" below if you want to extend this.

**Map dots:** dot *count* per state is real (proportional to the indicator
value). Dot *position* within a state is randomly generated for visual
texture only — it is not derived from any real household location data.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · MapLibre GL JS ·
Recharts · Framer Motion · Fuse.js

No basemap tiles or API keys are used — the map renders its own state
polygons on a flat dark background, which keeps the whole project
zero-config and avoids a Mapbox/MapTiler key requirement.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Data pipeline

Raw source files live in `raw-data/`. The build script merges them and
precomputes the dot layers:

```bash
npm run build:data
```

This regenerates everything in `public/data/`:
- `states.geojson` — state boundaries + all indicator values + bbox
- `dots/<indicator>.geojson` — one file per indicator, lazily fetched by
  the client only when that indicator is selected (keeps initial load
  small: the default "Pill" layer is ~460 KB)
- `meta.json` — national average / highest / lowest / rank per indicator
- `indicators.json` — the indicator catalogue that drives the dropdown

## Adding a new health indicator (e.g. anaemia, hypertension, diabetes)

The data layer is intentionally indicator-agnostic:

1. Add the raw state-level numbers to a JSON file shaped like
   `raw-data/nfhs5_family_planning_states.json`.
2. Add an entry to the `INDICATORS` array in `scripts/build-data.mjs`.
3. Run `npm run build:data`.

No component changes are required — the dropdown, stats cards, filters,
side panel, and dot layer all read from `indicators.json` / `meta.json` /
the `<key>_total` properties dynamically.

## Adding district-level data

To extend from state to district granularity:
1. Source district boundaries (e.g. from `datta07/INDIAN-SHAPEFILES` or the
   Survey of India) and simplify them with `mapshaper` the same way
   `raw-data/states_boundaries_raw.geojson` was produced.
2. Source district-level NFHS-5 figures — the same `jvargh7/nfhs5_factsheets`
   repo has a `districts.csv` you can extract from.
3. Point `scripts/build-data.mjs` at the district files instead of (or in
   addition to) the state files; the rest of the pipeline (dot generation,
   meta stats, ranks) works unchanged.

Expect materially larger file sizes (~766 districts) — you'll want to add
viewport-based or zoom-based lazy loading of the dot layer rather than
fetching one flat file per indicator.

## Deploying

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel — no environment variables or API keys needed.
3. Vercel will run `npm run build` automatically (`public/data/*` is
   already committed, so you don't need to re-run `build:data` at deploy
   time unless you change the source data).

## Project structure

```
app/                  Next.js App Router pages, layout, global styles
components/
  Map/                MapLibre map, hover tooltip, legend
  Panel/               State detail side panel / bottom sheet content
  Search/              Fuzzy search bar
  Filters/             Indicator / region / range filter panel
  Stats/                National summary stat cards
  UI/                  Shared UI (bottom sheet)
lib/                    Types, region mapping, data-fetching hooks
raw-data/                Source NFHS-5 extract + raw state boundaries
scripts/build-data.mjs  Data pipeline: merge + generate dot layers
public/data/            Generated output consumed by the client
```
