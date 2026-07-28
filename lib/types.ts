// Shared types. Keeping these generic (not hardcoded to "pill") is what
// lets a future indicator (anaemia, hypertension, diabetes...) be added
// just by adding an entry to public/data/indicators.json + a dots file -
// no component changes required.

export interface IndicatorMeta {
  key: string;
  label: string;
}

export interface StateProperties {
  state: string;
  state_code: string;
  nfhs_name: string;
  [indicatorField: string]: string | number | undefined; // "<key>_total" etc.
}

export interface StateFeature {
  type: "Feature";
  properties: StateProperties;
  geometry: GeoJSON.Geometry;
}

export interface StatesCollection {
  type: "FeatureCollection";
  features: StateFeature[];
}

export interface IndicatorNationalStats {
  label: string;
  national_average: number;
  highest: { state: string; value: number };
  lowest: { state: string; value: number };
  count: number;
  ranks: Record<string, number>;
}

export type MetaByIndicator = Record<string, IndicatorNationalStats>;

export interface StateLeaderboardEntry {
  state: string;
  avg: number;
  district_count: number;
}

export interface DotProperties {
  s: string; // state name
  v: number; // indicator value at time of dot generation
}

export type Region =
  | "North"
  | "South"
  | "East"
  | "West"
  | "Central"
  | "Northeast"
  | "Union Territory";
