// build-data.mjs
//
// DATA PROVENANCE:
// - State boundary + STATE-LEVEL Pill value: raw-data/states_boundaries_raw.geojson
//   + raw-data/nfhs5_family_planning_states.json. The state Pill % is the
//   REAL NFHS-5 survey estimate for that state (not an average of its
//   districts) - it's what the click panel and leaderboard show.
// - Dot texture: raw-data/districts_boundaries_raw.geojson +
//   raw-data/nfhs5_districts_raw.csv (district-level Pill %). Each
//   district gets its own dot cluster, scaled to its own real value, so a
//   state's dot cloud is organically denser in its higher-use districts -
//   but the OUTLINE drawn on the map is the state boundary only (district
//   lines are not rendered - that's what was cluttering it).
// - Both indicator: "Pill (%)" - current use of the oral contraceptive
//   pill among currently married women 15-49. This is NOT "i-Pill"
//   (emergency contraception), which NFHS does not measure.
//
// Run with: npm run build:data

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const p = (...parts) => path.join(ROOT, ...parts);

const DOT_SCALE = 3.2; // dots per percentage point per district
const MAX_DOTS_PER_DISTRICT = 140;
const MIN_DOTS_PER_DISTRICT = 4;
const round4 = (n) => Math.round(n * 10000) / 10000;

function norm(s) {
  let out = (s || "").toUpperCase();
  out = out.replace(/&/g, " AND ");
  out = out.replace(/[^A-Z0-9 ]/g, " ");
  out = out.replace(/\bAND\b/g, " ");
  out = out.replace(/\bTWENTY FOUR\b/g, "24");
  out = out.replace(/\s+/g, " ").trim();
  return out;
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

// ============================================================
// 1. STATE LAYER - real boundaries + real state-level Pill value
// ============================================================
const statesGeo = JSON.parse(fs.readFileSync(p("raw-data/states_boundaries_raw.geojson"), "utf8"));
const nfhsStates = JSON.parse(fs.readFileSync(p("raw-data/nfhs5_family_planning_states.json"), "utf8"));

const STATE_NAME_ALIASES = {
  "Andaman & Nicobar": "Andaman & Nicobar Islands",
  "Delhi": "NCT of Delhi",
  "Dadra & Nagar Haveli": "Dadra & Nagar Haveli and Daman & Diu",
  "Daman & Diu": "Dadra & Nagar Haveli and Daman & Diu",
};

// normalized-key -> canonical display name (STNAME_SH), used later to
// attach district dots to the correct state feature.
const canonicalByNormKey = new Map();
for (const f of statesGeo.features) {
  canonicalByNormKey.set(norm(f.properties.STNAME_SH), f.properties.STNAME_SH);
}

const stateFeatures = [];
for (const feature of statesGeo.features) {
  const shName = feature.properties.STNAME_SH;
  const nfhsKey = STATE_NAME_ALIASES[shName] || shName;
  const stats = nfhsStates[nfhsKey]?.pill;
  if (!stats) {
    console.warn("No state-level Pill stat for", shName);
    continue;
  }
  const bbox = turf.bbox(feature);
  stateFeatures.push({
    type: "Feature",
    properties: {
      state: shName,
      pill_total: stats.total,
      pill_urban: stats.urban,
      pill_rural: stats.rural,
      pill_nfhs4: stats.nfhs4,
      bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    },
    geometry: feature.geometry,
  });
}
console.log(`State layer: ${stateFeatures.length} states/UTs with real Pill %.`);

// ============================================================
// 2. DISTRICT LAYER - real district Pill values, used only for dot
//    density texture (never drawn as boundaries)
// ============================================================
const districtsGeo = JSON.parse(
  fs.readFileSync(p("raw-data/districts_boundaries_raw.geojson"), "utf8")
);

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
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
  if (cols[idx["Indicator"]] !== "25. Pill (%)") continue;
  const state = cols[idx["state"]];
  const district = cols[idx["district"]];
  const nfhs5 = parseFloat(cols[idx["NFHS5"]]);
  if (!state || !district || Number.isNaN(nfhs5)) continue;
  pillRows.push({ state, district, nfhs5 });
}

const geoByState = new Map();
for (const feature of districtsGeo.features) {
  const st = norm(feature.properties.state);
  const di = norm(feature.properties.district);
  if (!st || !di) continue;
  if (!geoByState.has(st)) geoByState.set(st, new Map());
  geoByState.get(st).set(di, feature);
}

const usedFeatureRefs = new Set();
const districtDots = []; // { state (canonical), district, value, geometry }
const districtsByState = new Map(); // canonical state name -> [{district, value}]
let districtMatched = 0;
let districtUnmatched = 0;

for (const row of pillRows) {
  const stKey = norm(row.state);
  const diKey = norm(row.district);
  const candidates = geoByState.get(stKey);
  let feature = null;

  if (candidates?.has(diKey)) {
    feature = candidates.get(diKey);
  } else if (candidates) {
    let best = null;
    let bestScore = 0;
    for (const [candName, candFeature] of candidates) {
      const score = diceCoefficient(diKey, candName);
      if (score > bestScore) {
        bestScore = score;
        best = candFeature;
      }
    }
    if (best && bestScore >= 0.6) feature = best;
  }

  const canonicalState = canonicalByNormKey.get(stKey);
  if (!feature || !canonicalState) {
    districtUnmatched++;
    continue;
  }
  const refKey = feature.properties.district + "|" + feature.properties.state;
  if (usedFeatureRefs.has(refKey)) {
    districtUnmatched++;
    continue;
  }
  usedFeatureRefs.add(refKey);
  districtMatched++;

  districtDots.push({ state: canonicalState, district: row.district, value: row.nfhs5, feature });
  if (!districtsByState.has(canonicalState)) districtsByState.set(canonicalState, []);
  districtsByState.get(canonicalState).push({ district: row.district, value: row.nfhs5 });
}
console.log(
  `District dot layer: ${districtMatched} matched / ${pillRows.length} (${(
    (districtMatched / pillRows.length) *
    100
  ).toFixed(1)}%), ${districtUnmatched} unmatched (see match-report.json).`
);

// Attach highest/lowest district-within-state to each state feature -
// answers "which district is highest/lowest/mid within this state".
for (const sf of stateFeatures) {
  const list = districtsByState.get(sf.properties.state);
  if (!list || list.length === 0) continue;
  const sorted = [...list].sort((a, b) => b.value - a.value);
  sf.properties.highest_district = sorted[0].district;
  sf.properties.highest_district_value = sorted[0].value;
  sf.properties.lowest_district = sorted[sorted.length - 1].district;
  sf.properties.lowest_district_value = sorted[sorted.length - 1].value;
  sf.properties.district_count_in_state = sorted.length;
}

fs.mkdirSync(p("public/data"), { recursive: true });
fs.writeFileSync(
  p("public/data/states.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: stateFeatures })
);

// ============================================================
// 3. Precompute dots: one cluster per district, tagged with parent state
// ============================================================
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

fs.mkdirSync(p("public/data/dots"), { recursive: true });
const dotFeatures = [];
for (const d of districtDots) {
  const count = Math.max(
    MIN_DOTS_PER_DISTRICT,
    Math.min(MAX_DOTS_PER_DISTRICT, Math.round(d.value * DOT_SCALE))
  );
  const points = randomPointsInFeature(d.feature, count);
  for (const [lng, lat] of points) {
    dotFeatures.push({
      type: "Feature",
      properties: { s: d.state, v: d.value },
      geometry: { type: "Point", coordinates: [round4(lng), round4(lat)] },
    });
  }
}
fs.writeFileSync(
  p("public/data/dots/pill.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: dotFeatures })
);
console.log(`Generated ${dotFeatures.length} dots across ${districtDots.length} districts.`);

// ============================================================
// 4. National meta stats - computed from real STATE values (36 states/UTs)
// ============================================================
const sorted = [...stateFeatures].sort((a, b) => b.properties.pill_total - a.properties.pill_total);
const values = stateFeatures.map((f) => f.properties.pill_total);
const nationalAvg = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
const ranks = {};
sorted.forEach((f, i) => {
  ranks[f.properties.state] = i + 1;
});

const meta = {
  pill: {
    label: "Oral Contraceptive Pill use (current use, married women 15-49)",
    national_average: nationalAvg,
    highest: { state: sorted[0].properties.state, value: sorted[0].properties.pill_total },
    lowest: {
      state: sorted[sorted.length - 1].properties.state,
      value: sorted[sorted.length - 1].properties.pill_total,
    },
    count: stateFeatures.length,
    ranks,
  },
};
fs.writeFileSync(p("public/data/meta.json"), JSON.stringify(meta, null, 2));

// ============================================================
// 5. Leaderboard - real per-state values (not an approximation)
// ============================================================
const leaderboard = sorted.map((f) => ({
  state: f.properties.state,
  avg: f.properties.pill_total,
  district_count: f.properties.district_count_in_state || 0,
}));
fs.writeFileSync(p("public/data/state_leaderboard.json"), JSON.stringify(leaderboard, null, 2));

fs.writeFileSync(
  p("public/data/indicators.json"),
  JSON.stringify([{ key: "pill", label: meta.pill.label }], null, 2)
);

fs.writeFileSync(
  p("public/data/match-report.json"),
  JSON.stringify(
    {
      matched: districtMatched,
      unmatched: districtUnmatched,
      total: pillRows.length,
      note: "District matches feed dot density texture only. State boundaries/values are exact NFHS-5 survey figures, independent of this match rate.",
    },
    null,
    2
  )
);

console.log("Done. Files written to public/data/");
