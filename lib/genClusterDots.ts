import * as turf from "@turf/turf";
import type { StatesCollection } from "./types";

/**
 * IMPORTANT: These points are NOT real data. NFHS-5 only publishes state-level
 * (and urban/rural) estimates for these indicators — there is no district or
 * point-level survey data behind this. Each state gets a synthetic scatter of
 * points whose *count, spacing, and glow* are derived from that state's single
 * indicator value, purely so the map reads as a density visualization instead
 * of one flat bubble per state. Do not treat individual points as observations.
 */

export interface ClusterPointProps {
  state: string;
  s: string; // duplicate key used by existing IndiaMap filters (["get","s"])
  v: number; // normalized 0..1 intensity for this state + indicator
  size: number; // per-point relative size multiplier (organic variance)
}

const MIN_POINTS = 10;
const MAX_POINTS = 85;
const MIN_SEEDS = 1;
const MAX_SEEDS = 6;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Gaussian jitter via Box-Muller, returned in degrees.
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
  maxAttempts = 6
): [number, number] | null {
  let radiusScale = 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [dx, dy] = gaussianOffset(stdLon * radiusScale, stdLat * radiusScale);
    const candidate: [number, number] = [center[0] + dx, center[1] + dy];
    if (turf.booleanPointInPolygon(candidate, feature as any)) {
      return candidate;
    }
    radiusScale *= 0.55; // pull in tighter toward center each retry
  }
  return null;
}

/**
 * Builds a synthetic FeatureCollection of glowing points per state, styled to
 * look like a density visualization. Point count, clustering tightness, and
 * per-point size all scale with the state's normalized value for `indicatorKey`.
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

    const v = Math.min(1, Math.max(0, (rawValue - min) / range));

    // Anchor guaranteed inside the polygon (handles Polygon + MultiPolygon).
    const anchorFeature = turf.pointOnFeature(feature as any);
    const anchor = anchorFeature.geometry.coordinates as [number, number];

    const bbox = turf.bbox(feature as any);
    const lonExtent = bbox[2] - bbox[0];
    const latExtent = bbox[3] - bbox[1];

    // Higher value => seeds packed closer together (denser hotspot).
    const seedSpreadLon = lonExtent * lerp(0.24, 0.05, v);
    const seedSpreadLat = latExtent * lerp(0.24, 0.05, v);

    // Higher value => tighter, more overlapping scatter around each seed.
    const dotSpreadLon = lonExtent * lerp(0.1, 0.03, v);
    const dotSpreadLat = latExtent * lerp(0.1, 0.03, v);

    const numSeeds = Math.round(lerp(MIN_SEEDS, MAX_SEEDS, v));
    const totalPoints = Math.round(lerp(MIN_POINTS, MAX_POINTS, v));
    const pointsPerSeed = Math.max(1, Math.round(totalPoints / numSeeds));

    const seeds: [number, number][] = [anchor];
    for (let i = 1; i < numSeeds; i++) {
      const seed = randomPointNear(anchor, seedSpreadLon, seedSpreadLat, feature as GeoJSON.Feature);
      seeds.push(seed ?? anchor);
    }

    for (const seed of seeds) {
      for (let i = 0; i < pointsPerSeed; i++) {
        const pt = randomPointNear(seed, dotSpreadLon, dotSpreadLat, feature as GeoJSON.Feature);
        const coords = pt ?? seed;
        const sizeJitter = 0.65 + Math.random() * 0.7; // organic per-dot variance
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: {
            state: stateName,
            s: stateName,
            v,
            size: sizeJitter,
          } as ClusterPointProps,
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}
