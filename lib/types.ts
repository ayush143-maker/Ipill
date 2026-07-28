// Shared types. Keeping these generic (not hardcoded to "pill") is what
// lets a future indicator (anaemia, hypertension, diabetes...) be added
// just by adding an entry to public/data/indicators.json + a dots file -
// no component changes required.

export interface IndicatorMeta {
  key: string;
  label: string;
}

export interface DistrictProperties {
  uid: string;
  state: string;
  district: string;
  pill_total: number;
  pill_nfhs4: number | null;
  bbox: [number, number, number, number];
  [indicatorField: string]: string | number | number[] | null | undefined;
}

export interface DistrictFeature {
  type: "Feature";
  properties: DistrictProperties;
  geometry: GeoJSON.Geometry;
}

export interface DistrictsCollection {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

export interface IndicatorNationalStats {
  label: string;
  national_average: number;
  highest: { district: string; state: string; value: number };
  lowest: { district: string; state: string; value: number };
  count: number;
  ranks: Record<string, number>; // key: "state|district"
}

export type MetaByIndicator = Record<string, IndicatorNationalStats>;

export interface DotProperties {
  s: string; // state name
  d: string; // district name
  v: number; // indicator value at time of dot generation
}

export interface StateLeaderboardEntry {
  state: string;
  avg: number;
  district_count: number;
}

export type Region =
  | "North"
  | "South"
  | "East"
  | "West"
  | "Central"
  | "Northeast"
  | "Union Territory";

