// build-data.mjs
//
// DATA PROVENANCE:
// - raw-data/nfhs5_districts_raw.csv is the full NFHS-5 (2019-21) District
//   Factsheet extract from https://github.com/jvargh7/nfhs5_factsheets
//   (long format: state, district, Indicator, NFHS5, NFHS4). We use
//   indicator "25. Pill (%)" - current use of the oral contraceptive pill
//   among currently married women 15-49, per district. This is a REAL,
//   sourced, district-level figure - not the same thing as "i-Pill"
//   (emergency contraception), which NFHS does not measure at all.
// - raw-data/districts_boundaries_raw.geojson is simplified from
//   datta07/INDIAN-SHAPEFILES (INDIA_DISTRICTS.geojson), a community-
//   maintained district shapefile of variable vintage/accuracy.
//
// MATCHING: district names are matched between the two sources by
// normalizing (uppercase, strip punctuation, strip "AND", 24->24, etc.)
// then exact match, falling back to fuzzy match (Dice coefficient) within
// the same state. This is NOT perfect - India's district boundaries have
// changed a lot (splits, renames) between when each source was compiled.
// Every match, its method, and every miss is logged to
// public/data/match-report.json so the gap is auditable, not hidden.
//
// Run with: npm run build:data

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const p = (...parts) => path.join(ROOT, ...parts);

const districtsGeo = JSON.parse(
  fs.readFileSync(p("raw-data/districts_boundaries_raw.geojson"), "utf8")
);

const INDICATOR_STRING = "25. Pill (%)";
const DOT_SCALE = 3.2; // dots per percentage point per district (denser, finer texture)
const MAX_DOTS = 140;
const MIN_DOTS = 4;

// ---- 1. Parse NFHS-5 district CSV (long format) ----
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const rawCsv = fs.readFileSync(p("raw-data/nfhs5_districts_raw.csv"), "utf8");
const lines = rawCsv.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const pillRows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols[idx["Indicator"]] !== INDICATOR_STRING) continue;
  const state = cols[idx["state"]];
  const district = cols[idx["district"]];
  const nfhs5 = parseFloat(cols[idx["NFHS5"]]);
  const nfhs4 = parseFloat(cols[idx["NFHS4"]]);
  if (!state || !district || Number.isNaN(nfhs5)) continue;
  pillRows.push({ state, district, nfhs5, nfhs4: Number.isNaN(nfhs4) ? null : nfhs4 });
}
console.log(`Parsed ${pillRows.length} district rows with a valid Pill (%) value.`);

// ---- 2. Name normalization + matching ----
const STATE_ALIASES = {
  "NCT DELHI": "DELHI",
};

function norm(s) {
  let out = (s || "").toUpperCase();
  out = out.replace(/&/g, " AND ");
  out = out.replace(/[^A-Z0-9 ]/g, " ");
  out = out.replace(/\bAND\b/g, " ");
  out = out.replace(/\bTWENTY FOUR\b/g, "24");
  out = out.replace(/\s+/g, " ").trim();
  return STATE_ALIASES[out] || out;
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const ma = bigrams(a);
  const mb = bigrams(b);
  let overlap = 0;
  for (const [bg, count] of ma) {
    if (mb.has(bg)) overlap += Math.min(count, mb.get(bg));
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

const geoByState = new Map();
for (const feature of districtsGeo.features) {
  const st = norm(feature.properties.state);
  const di = norm(feature.properties.district);
  if (!st || !di) continue;
  if (!geoByState.has(st)) geoByState.set(st, new Map());
  geoByState.get(st).set(di, feature);
}

const matchReport = { exact: [], fuzzy: [], unmatched: [] };
const mergedFeatures = [];
const usedFeatureRefs = new Set();

for (const row of pillRows) {
  const st = norm(row.state);
  const di = norm(row.district);
  const candidates = geoByState.get(st);
  let feature = null;
  let method = null;

  if (candidates?.has(di)) {
    feature = candidates.get(di);
    method = "exact";
  } else if (candidates) {
    let best = null;
    let bestScore = 0;
    for (const [candName, candFeature] of candidates) {
      const score = diceCoefficient(di, candName);
      if (score > bestScore) {
        bestScore = score;
        best = candFeature;
      }
    }
    if (best && bestScore >= 0.6) {
      feature = best;
      method = "fuzzy";
    }
  }

  if (!feature) {
    matchReport.unmatched.push({ state: row.state, district: row.district });
    continue;
  }

  const refKey = feature.properties.district + "|" + feature.properties.state;
  if (usedFeatureRefs.has(refKey)) {
    matchReport.unmatched.push({
      state: row.state,
      district: row.district,
      reason: "duplicate boundary",
    });
    continue;
  }
  usedFeatureRefs.add(refKey);

  matchReport[method].push({
    state: row.state,
    district: row.district,
    matched_to: feature.properties.district,
  });

  const bbox = turf.bbox(feature);
  mergedFeatures.push({
    type: "Feature",
    properties: {
      uid: `${row.state}|${row.district}`,
      state: row.state,
      district: row.district,
      pill_total: row.nfhs5,
      pill_nfhs4: row.nfhs4,
      bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    },
    geometry: feature.geometry,
  });
}

console.log(
  `Matched: ${matchReport.exact.length} exact + ${matchReport.fuzzy.length} fuzzy = ${
    matchReport.exact.length + matchReport.fuzzy.length
  } / ${pillRows.length} (${(
    ((matchReport.exact.length + matchReport.fuzzy.length) / pillRows.length) *
    100
  ).toFixed(1)}%). Unmatched: ${matchReport.unmatched.length}.`
);

fs.mkdirSync(p("public/data"), { recursive: true });
fs.writeFileSync(p("public/data/match-report.json"), JSON.stringify(matchReport, null, 2));

// ---- 3. Write merged district boundaries ----
const outDistricts = { type: "FeatureCollection", features: mergedFeatures };
fs.writeFileSync(p("public/data/districts.geojson"), JSON.stringify(outDistricts));

// ---- 4. National + rank stats ----
const sorted = [...mergedFeatures].sort(
  (a, b) => b.properties.pill_total - a.properties.pill_total
);
const values = mergedFeatures.map((f) => f.properties.pill_total);
const nationalAvg = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
const ranks = {};
sorted.forEach((f, i) => {
  ranks[`${f.properties.state}|${f.properties.district}`] = i + 1;
});

const meta = {
  pill: {
    label: "Oral Contraceptive Pill use (current use, married women 15-49)",
    national_average: nationalAvg,
    highest: {
      district: sorted[0].properties.district,
      state: sorted[0].properties.state,
      value: sorted[0].properties.pill_total,
    },
    lowest: {
      district: sorted[sorted.length - 1].properties.district,
      state: sorted[sorted.length - 1].properties.state,
      value: sorted[sorted.length - 1].properties.pill_total,
    },
    count: mergedFeatures.length,
    ranks,
  },
};
fs.writeFileSync(p("public/data/meta.json"), JSON.stringify(meta, null, 2));

// ---- 5. State leaderboard (avg of matched districts per state) ----
const byState = new Map();
for (const f of mergedFeatures) {
  const s = f.properties.state;
  if (!byState.has(s)) byState.set(s, []);
  byState.get(s).push(f.properties.pill_total);
}
const leaderboard = Array.from(byState.entries())
  .map(([state, vals]) => ({
    state,
    avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    district_count: vals.length,
  }))
  .sort((a, b) => b.avg - a.avg);
fs.writeFileSync(p("public/data/state_leaderboard.json"), JSON.stringify(leaderboard, null, 2));

// ---- 6. Precompute dense dot layer ----
function randomPointsInFeature(feature, count) {
  const pts = [];
  const bbox = turf.bbox(feature);
  let attempts = 0;
  const maxAttempts = count * 50 + 300;
  while (pts.length < count && attempts < maxAttempts) {
    attempts++;
    const lng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
    const pt = turf.point([lng, lat]);
    if (turf.booleanPointInPolygon(pt, feature)) pts.push([lng, lat]);
  }
  return pts;
}
const round4 = (n) => Math.round(n * 10000) / 10000;

fs.mkdirSync(p("public/data/dots"), { recursive: true });
const dotFeatures = [];
for (const feature of mergedFeatures) {
  const val = feature.properties.pill_total;
  const count = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.round(val * DOT_SCALE)));
  const points = randomPointsInFeature(feature, count);
  for (const [lng, lat] of points) {
    dotFeatures.push({
      type: "Feature",
      properties: { s: feature.properties.state, d: feature.properties.district, v: val },
      geometry: { type: "Point", coordinates: [round4(lng), round4(lat)] },
    });
  }
}
fs.writeFileSync(
  p("public/data/dots/pill.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: dotFeatures })
);
console.log(`Generated ${dotFeatures.length} dots across ${mergedFeatures.length} districts.`);

fs.writeFileSync(
  p("public/data/indicators.json"),
  JSON.stringify([{ key: "pill", label: meta.pill.label }], null, 2)
);

console.log("Done. Files written to public/data/");
