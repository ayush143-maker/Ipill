import * as turf from "@turf/turf";
import type { StatesCollection } from "./types";

/**
 * IMPORTANT: These points are NOT real data. NFHS-5 only publishes
 * state-level (and urban/rural) estimates for these indicators — there is
 * no district or point-level survey data behind this. Every point below is
 * a synthetic visual particle whose count, placement, and glow are derived
 * from that state's single indicator value, purely so the map reads as a
 * dense scientific-visualization field instead of one bubble per state.
 * Do not treat individual points as observations, districts, or people.
 */

export interface ClusterPointProps {
  state: string;
  s: string; // duplicate key used by IndiaMap's existing ["get","s"] filters
  v: number; // normalized 0..1 intensity for this state + indicator
  role: "scatter" | "cluster";
  size: number; // per-point relative size multiplier (bakes in state intensity + role + jitter)
  glow: number; // per-point opacity/glow driver, 0..1 (bakes in state intensity + role + jitter)
}

// Total particles per state scale ~5x over the old single-density version.
const MIN_TOTAL = 60;
const MAX_TOTAL = 450;
const SCATTER_FRACTION = 0.65;

const MIN_CLUSTER_SEEDS = 2;
const MAX_CLUSTER_SEEDS = 9;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function gaussianOffset(stdLon: number, stdLat: number): [number, number] {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  const dx = mag * Math.cos(2 * Math.PI * v) * stdLon;
  const dy = mag * Math.sin(2 * Math.PI * v) * stdLat;
  return [dx, dy];
}

function randomPointNear(
  center: [number, number],
  stdLon: number,
  stdLat: number,
  feature: GeoJSON.Feature,
  maxAttempts = 10
): [number, number] {
  let radiusScale = 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [dx, dy] = gaussianOffset(stdLon * radiusScale, stdLat * radiusScale);
    const candidate: [number, number] = [center[0] + dx, center[1] + dy];
    if (turf.booleanPointInPolygon(candidate, feature as any)) return candidate;
    radiusScale *= 0.55;
  }
  // Every attempt landed outside the polygon (tiny/sliver state). Rather than
  // returning `center` verbatim — which stacks many failed points on the
  // exact same coordinate and renders as one fused mega-circle — nudge by a
  // small random offset so failed points still spread out visually.
  const angle = Math.random() * Math.PI * 2;
  const nudge = Math.min(stdLon, stdLat) * 0.25;
  return [center[0] + Math.cos(angle) * nudge, center[1] + Math.sin(angle) * nudge];
}

// Small/compact states (Sikkim, Goa, UTs) shouldn't receive the same raw
// point count as a state 20x their size — that's what crams hundreds of
// points into a sliver of land and forces constant placement failures,
// which is what produced the fused "lollipop" blob. Scale count by area.
function areaScaleFactor(feature: GeoJSON.Feature): number {
  const areaM2 = turf.area(feature as any);
  const areaKm2 = areaM2 / 1_000_000;
  const REFERENCE_KM2 = 60_000; // roughly a mid-sized Indian state
  const raw = Math.sqrt(areaKm2 / REFERENCE_KM2);
  return Math.min(1.15, Math.max(0.3, raw));
}

// Semi-random "jittered grid": lays a coarse grid over the state's bbox,
// jitters each cell center by up to ~90% of the cell size, randomly drops a
// small fraction of cells, and rejects anything outside the polygon. This
// gives even, gap-free coverage (unlike pure random noise, which clumps and
// leaves holes) while the jitter + random drops keep it from reading as a
// mechanical grid.
function jitteredGridScatter(
  feature: GeoJSON.Feature,
  targetCount: number
): Array<[number, number]> {
  if (targetCount <= 0) return [];
  const bbox = turf.bbox(feature as any);
  const lonExtent = Math.max(bbox[2] - bbox[0], 1e-6);
  const latExtent = Math.max(bbox[3] - bbox[1], 1e-6);

  // Oversample the grid since many cells (near irregular borders/coastline)
  // will fail the point-in-polygon test or get randomly dropped.
  const oversample = 1.7;
  const adjusted = targetCount * oversample;
  const aspect = lonExtent / latExtent;
  const cols = Math.max(1, Math.round(Math.sqrt(adjusted * aspect)));
  const rows = Math.max(1, Math.round(adjusted / cols));

  const cellW = lonExtent / cols;
  const cellH = latExtent / rows;
  const points: Array<[number, number]> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() < 0.08) continue; // organic gaps, not a hard hole
      const baseX = bbox[0] + (col + 0.5) * cellW;
      const baseY = bbox[1] + (row + 0.5) * cellH;
      const jitterX = (Math.random() - 0.5) * cellW * 0.9;
      const jitterY = (Math.random() - 0.5) * cellH * 0.9;
      let candidate: [number, number] = [baseX + jitterX, baseY + jitterY];
      if (!turf.booleanPointInPolygon(candidate, feature as any)) {
        // one retry, pulled toward the cell center, before giving up on this cell
        candidate = [baseX + jitterX * 0.35, baseY + jitterY * 0.35];
        if (!turf.booleanPointInPolygon(candidate, feature as any)) continue;
      }
      points.push(candidate);
      if (points.length >= targetCount * 1.15) return points;
    }
  }

  // Top-up: odd-shaped, small, or coastal states can undershoot the grid
  // pass (many cells reject near concave borders). Fill the remainder with
  // plain rejection sampling so no state ever falls short of its floor.
  let guard = 0;
  while (points.length < targetCount && guard < targetCount * 40) {
    guard++;
    const candidate: [number, number] = [
      bbox[0] + Math.random() * lonExtent,
      bbox[1] + Math.random() * latExtent,
    ];
    if (turf.booleanPointInPolygon(candidate, feature as any)) {
      points.push(candidate);
    }
  }
  return points;
}

/**
 * Builds a synthetic FeatureCollection of glowing particles per state: ~65%
 * spread via jittered-grid scatter (never empty, organic, not a grid), ~35%
 * forming Gaussian hotspot clusters. Count, cluster count/tightness, size,
 * and glow all scale with the state's normalized value for `indicatorKey`.
 */
export function buildClusterDots(
  states: StatesCollection,
  indicatorKey: string
): GeoJSON.FeatureCollection {
  const propKey = `${indicatorKey}_total`;

  const values = states.features
    .map((f) => (f.properties as Record<string, number | undefined>)[propKey])
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  const features: GeoJSON.Feature[] = [];

  for (const feature of states.features) {
    const props = feature.properties as Record<string, unknown>;
    const stateName = props.state as string;
    const rawValue = props[propKey] as number | undefined;
    if (rawValue == null) continue;

    const v = clamp01((rawValue - min) / range);
    const areaScale = areaScaleFactor(feature as GeoJSON.Feature);

    const total = Math.round(lerp(MIN_TOTAL, MAX_TOTAL, v) * areaScale);
    const scatterTarget = Math.round(total * SCATTER_FRACTION);
    const clusterTarget = total - scatterTarget;

    // --- 65%: gap-free organic scatter, present even in the lowest state ---
    const scatterPts = jitteredGridScatter(feature as GeoJSON.Feature, scatterTarget);
    for (const coords of scatterPts) {
      const sizeJitter = 0.75 + Math.random() * 0.4;
      const glowJitter = 0.55 + Math.random() * 0.25;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          state: stateName,
          s: stateName,
          v,
          role: "scatter",
          size: sizeJitter * lerp(0.85, 1.3, v),
          glow: clamp01(glowJitter * lerp(0.75, 1.0, v)),
        } as ClusterPointProps,
      });
    }

    // --- 35%: Gaussian hotspot clusters, denser/brighter/more numerous as v rises ---
    const anchorFeature = turf.pointOnFeature(feature as any);
    const anchor = anchorFeature.geometry.coordinates as [number, number];
    const bbox = turf.bbox(feature as any);
    const lonExtent = bbox[2] - bbox[0];
    const latExtent = bbox[3] - bbox[1];

    const seedSpreadLon = lonExtent * lerp(0.22, 0.06, v);
    const seedSpreadLat = latExtent * lerp(0.22, 0.06, v);
    const dotSpreadLon = lonExtent * lerp(0.09, 0.035, v);
    const dotSpreadLat = latExtent * lerp(0.09, 0.035, v);

    const numSeeds = Math.round(lerp(MIN_CLUSTER_SEEDS, MAX_CLUSTER_SEEDS, v));
    const pointsPerSeed = Math.max(1, Math.round(clusterTarget / numSeeds));

    const seeds: [number, number][] = [anchor];
    for (let i = 1; i < numSeeds; i++) {
      const seed = randomPointNear(anchor, seedSpreadLon, seedSpreadLat, feature as GeoJSON.Feature);
      seeds.push(seed);
    }

    for (const seed of seeds) {
      for (let i = 0; i < pointsPerSeed; i++) {
        const coords = randomPointNear(seed, dotSpreadLon, dotSpreadLat, feature as GeoJSON.Feature);
        const sizeJitter = 0.85 + Math.random() * 0.6;
        const glowJitter = 0.55 + Math.random() * 0.35;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: {
            state: stateName,
            s: stateName,
            v,
            role: "cluster",
            size: sizeJitter * lerp(0.9, 1.7, v),
            glow: clamp01(glowJitter * lerp(0.75, 1.25, v)),
          } as ClusterPointProps,
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
        }
      
