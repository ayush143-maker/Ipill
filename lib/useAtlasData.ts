"use client";

import { useEffect, useRef, useState } from "react";
import type { IndicatorMeta, MetaByIndicator, StatesCollection } from "./types";

interface AtlasCore {
  states: StatesCollection | null;
  meta: MetaByIndicator | null;
  indicators: IndicatorMeta[] | null;
  loading: boolean;
  error: string | null;
}

// Loads the always-needed core data (boundaries + national stats + the
// indicator catalogue) once on mount.
export function useAtlasCore(): AtlasCore {
  const [states, setStates] = useState<StatesCollection | null>(null);
  const [meta, setMeta] = useState<MetaByIndicator | null>(null);
  const [indicators, setIndicators] = useState<IndicatorMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statesRes, metaRes, indicatorsRes] = await Promise.all([
          fetch("/data/states.geojson"),
          fetch("/data/meta.json"),
          fetch("/data/indicators.json"),
        ]);
        if (!statesRes.ok || !metaRes.ok || !indicatorsRes.ok) {
          throw new Error("Failed to load core atlas data");
        }
        const [statesJson, metaJson, indicatorsJson] = await Promise.all([
          statesRes.json(),
          metaRes.json(),
          indicatorsRes.json(),
        ]);
        if (cancelled) return;
        setStates(statesJson);
        setMeta(metaJson);
        setIndicators(indicatorsJson);
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

  return { states, meta, indicators, loading, error };
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
