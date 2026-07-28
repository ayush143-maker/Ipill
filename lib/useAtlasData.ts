"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DistrictsCollection,
  IndicatorMeta,
  MetaByIndicator,
  StateLeaderboardEntry,
} from "./types";

interface AtlasCore {
  districts: DistrictsCollection | null;
  meta: MetaByIndicator | null;
  indicators: IndicatorMeta[] | null;
  leaderboard: StateLeaderboardEntry[] | null;
  loading: boolean;
  error: string | null;
}

// Loads the always-needed core data once on mount: district boundaries +
// values, national stats, the indicator catalogue, and the state
// leaderboard (average across that state's matched districts).
export function useAtlasCore(): AtlasCore {
  const [districts, setDistricts] = useState<DistrictsCollection | null>(null);
  const [meta, setMeta] = useState<MetaByIndicator | null>(null);
  const [indicators, setIndicators] = useState<IndicatorMeta[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<StateLeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [districtsRes, metaRes, indicatorsRes, leaderboardRes] = await Promise.all([
          fetch("/data/districts.geojson"),
          fetch("/data/meta.json"),
          fetch("/data/indicators.json"),
          fetch("/data/state_leaderboard.json"),
        ]);
        if (!districtsRes.ok || !metaRes.ok || !indicatorsRes.ok || !leaderboardRes.ok) {
          throw new Error("Failed to load core atlas data");
        }
        const [districtsJson, metaJson, indicatorsJson, leaderboardJson] = await Promise.all([
          districtsRes.json(),
          metaRes.json(),
          indicatorsRes.json(),
          leaderboardRes.json(),
        ]);
        if (cancelled) return;
        setDistricts(districtsJson);
        setMeta(metaJson);
        setIndicators(indicatorsJson);
        setLeaderboard(leaderboardJson);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { districts, meta, indicators, leaderboard, loading, error };
}

// Lazily fetches and caches (in-memory, per session) the dot GeoJSON for a
// given indicator key. Switching indicators after the first load is instant.
export function useIndicatorDots(indicatorKey: string) {
  const cache = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(
    cache.current.get(indicatorKey) ?? null
  );
  const [loading, setLoading] = useState(!cache.current.has(indicatorKey));

  useEffect(() => {
    let cancelled = false;
    if (cache.current.has(indicatorKey)) {
      setData(cache.current.get(indicatorKey)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/data/dots/${indicatorKey}.geojson`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        cache.current.set(indicatorKey, json);
        setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [indicatorKey]);

  return { data, loading };
}
