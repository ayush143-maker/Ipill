// Shared types. Indicator is kept generic so a future indicator (anaemia,
// hypertension...) can be added by extending the data pipeline only.

export interface IndicatorMeta {
  key: string;
  label: string;
}

export interface StateProperties {
  state: string;
  pill_total: number;
  pill_urban: number;
  pill_rural: number;
  pill_nfhs4: number | null;
  bbox: [number, number, number, number];
  highest_district?: string;
  highest_district_value?: number;
  lowest_district?: string;
  lowest_district_value?: number;
  district_count_in_state?: number;
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
  ranks: Record<string, number>; // key: state name
}

export type MetaByIndicator = Record<string, IndicatorNationalStats>;

export interface DotProperties {
  s: string; // parent state name
  v: number; // source district's real value (density driver)
}

export interface StateLeaderboardEntry {
  state: string;
  avg: number; // real state-level Pill % (not an approximation)
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
