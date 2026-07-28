"use client";

import { useEffect, useState } from "react";
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
