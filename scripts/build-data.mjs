// build-data.mjs
//
// DATA PROVENANCE (read this before you trust any number on the map):
// - raw-data/nfhs5_family_planning_states.json is extracted from the
//   official NFHS-5 (2019-21) State Factsheet compendium, via the public
//   extraction repo https://github.com/jvargh7/nfhs5_factsheets
//   (indicators 28-35: "Current use of family planning methods").
// - There is NO published NFHS indicator specifically for "i-Pill" /
//   emergency contraceptive USE at state or district level. The closest
//   real, sourced proxy is indicator 33, "Pill (%)" - current use of the
//   regular oral contraceptive pill among currently married women 15-49.
//   This app uses that as the default indicator and labels it honestly
//   in the UI rather than calling it "i-Pill usage".
// - Boundaries are state/UT level only (36 states/UTs; district boundaries
//   are a separate, larger effort - see README "Adding district data").
// - Dot POSITIONS within each state are randomly generated for visual
//   texture only; they do not represent real household locations. Dot
//   COUNT per state is proportional to the real indicator value.
//
// Merges NFHS-5 state-level family planning indicators with state boundary
// GeoJSON, and precomputes randomized "glow dot" point features inside each
// state polygon (count proportional to the selected indicator value).
//
// Run with: npm run build:data  (from project root)
// Outputs:
//   public/data/states.geojson   (state boundaries + all indicator props)
//   public/data/dots.geojson     (precomputed dot points for every indicator)
//   public/data/meta.json        (national stats per indicator)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const p = (...parts) => path.join(ROOT, ...parts);

const statesGeo = JSON.parse(fs.readFileSync(p("raw-data/states_boundaries_raw.geojson"), "utf8"));
const nfhs = JSON.parse(fs.readFileSync(p("raw-data/nfhs5_family_planning_states.json"), "utf8"));

// Map GeoJSON STNAME_SH -> NFHS-5 state key
const NAME_MAP = {
  "Andaman & Nicobar": "Andaman & Nicobar Islands",
  "Delhi": "NCT of Delhi",
  "Dadra & Nagar Haveli": "Dadra & Nagar Haveli and Daman & Diu",
  "Daman & Diu": "Dadra & Nagar Haveli and Daman & Diu",
};

const INDICATORS = [
  { key: "pill", label: "Oral Contraceptive Pill use" },
  { key: "modern_method", label: "Any modern method" },
  { key: "any_method", label: "Any method (modern + traditional)" },
  { key: "female_sterilization", label: "Female sterilization" },
  { key: "condom", label: "Condom" },
  { key: "iud", label: "IUD / PPIUD" },
  { key: "injectables", label: "Injectables" },
];

// Dots-per-percentage-point scale factor, tuned so busiest state ~500-700 dots
const DOT_SCALE = 18;
const MAX_DOTS_PER_STATE = 900;
const MIN_DOTS_PER_STATE = 6;

let missing = [];
const mergedFeatures = [];

for (const feature of statesGeo.features) {
  const shName = feature.properties.STNAME_SH;
  const nfhsKey = NAME_MAP[shName] || shName;
  const stats = nfhs[nfhsKey];
  if (!stats) {
    missing.push(shName);
    continue;
  }

  const bbox = turf.bbox(feature);
  const props = {
    state: shName,
    state_code: feature.properties.STCODE11,
    nfhs_name: nfhsKey,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
  };
  for (const { key } of INDICATORS) {
    if (stats[key]) {
      props[`${key}_total`] = stats[key].total;
      props[`${key}_urban`] = stats[key].urban;
      props[`${key}_rural`] = stats[key].rural;
      props[`${key}_nfhs4`] = stats[key].nfhs4;
    }
  }

  mergedFeatures.push({
    type: "Feature",
    properties: props,
    geometry: feature.geometry,
  });
}

console.log("Unmatched states:", missing);
console.log("Merged features:", mergedFeatures.length);

const outStates = { type: "FeatureCollection", features: mergedFeatures };
fs.mkdirSync(p("public/data"), { recursive: true });
fs.writeFileSync(p("public/data/states.geojson"), JSON.stringify(outStates));

// ---- Precompute dot points per indicator ----
// Rejection-sample random points inside each polygon's bbox until inside.
function randomPointsInFeature(feature, count) {
  const pts = [];
  const bbox = turf.bbox(feature);
  let attempts = 0;
  const maxAttempts = count * 40 + 200;
  while (pts.length < count && attempts < maxAttempts) {
    attempts++;
    const lng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
    const pt = turf.point([lng, lat]);
    if (turf.booleanPointInPolygon(pt, feature)) {
      pts.push([lng, lat]);
    }
  }
  return pts;
}

// One compact file per indicator, fetched lazily on the client only when
// that indicator is selected. Coordinates rounded to 4dp (~11m) to keep
// payloads small on low-end mobile connections.
const round4 = (n) => Math.round(n * 10000) / 10000;

fs.mkdirSync(p("public/data/dots"), { recursive: true });
for (const { key } of INDICATORS) {
  const dotFeatures = [];
  for (const feature of mergedFeatures) {
    const val = feature.properties[`${key}_total`];
    if (val == null) continue;
    const count = Math.max(
      MIN_DOTS_PER_STATE,
      Math.min(MAX_DOTS_PER_STATE, Math.round(val * DOT_SCALE))
    );
    const points = randomPointsInFeature(feature, count);
    for (const [lng, lat] of points) {
      dotFeatures.push({
        type: "Feature",
        properties: { s: feature.properties.state, v: val },
        geometry: { type: "Point", coordinates: [round4(lng), round4(lat)] },
      });
    }
  }
  fs.writeFileSync(
    p(`public/data/dots/${key}.geojson`),
    JSON.stringify({ type: "FeatureCollection", features: dotFeatures })
  );
  console.log(`Indicator ${key}: ${dotFeatures.length} dots -> dots/${key}.geojson`);
}

// ---- National meta stats per indicator ----
const meta = {};
for (const { key, label } of INDICATORS) {
  const values = mergedFeatures
    .map((f) => f.properties[`${key}_total`])
    .filter((v) => v != null);
  const sorted = [...mergedFeatures]
    .filter((f) => f.properties[`${key}_total`] != null)
    .sort((a, b) => b.properties[`${key}_total`] - a.properties[`${key}_total`]);
  meta[key] = {
    label,
    national_average: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
    highest: {
      state: sorted[0].properties.state,
      value: sorted[0].properties[`${key}_total`],
    },
    lowest: {
      state: sorted[sorted.length - 1].properties.state,
      value: sorted[sorted.length - 1].properties[`${key}_total`],
    },
    count: values.length,
    // rank lookup: state -> national rank (1 = highest)
    ranks: Object.fromEntries(
      sorted.map((f, i) => [f.properties.state, i + 1])
    ),
  };
}
fs.writeFileSync(p("public/data/meta.json"), JSON.stringify(meta, null, 2));
fs.writeFileSync(
  p("public/data/indicators.json"),
  JSON.stringify(INDICATORS, null, 2)
);

console.log("Done. Files written to public/data/");
