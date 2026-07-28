"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, MapPin } from "lucide-react";
import { useAtlasCore, useIndicatorDots } from "@/lib/useAtlasData";
import { useIsMobile } from "@/lib/useIsMobile";
import { STATE_REGION } from "@/lib/regions";
import type { DistrictFeature, Region } from "@/lib/types";
import SearchBar from "@/components/Search/SearchBar";
import FilterPanel from "@/components/Filters/FilterPanel";
import StatsCards from "@/components/Stats/StatsCards";
import Leaderboard from "@/components/Stats/Leaderboard";
import DistrictPanel from "@/components/Panel/DistrictPanel";
import HoverTooltip from "@/components/Map/HoverTooltip";
import Legend from "@/components/Map/Legend";
import BottomSheet from "@/components/UI/BottomSheet";

const IndiaMap = dynamic(() => import("@/components/Map/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-bg">
      <div className="text-sm text-text-muted">Loading map…</div>
    </div>
  ),
});

const DEFAULT_INDICATOR = "pill";

export default function Home() {
  const { districts, meta, indicators, leaderboard, loading, error } = useAtlasCore();
  const [indicatorKey, setIndicatorKey] = useState(DEFAULT_INDICATOR);
  const { data: dots } = useIndicatorDots(indicatorKey);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [flyToBbox, setFlyToBbox] = useState<[number, number, number, number] | null>(null);
  const [hover, setHover] = useState<{ uid: string | null; x: number; y: number }>({
    uid: null,
    x: 0,
    y: 0,
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeRegions, setActiveRegions] = useState<Set<Region>>(new Set());
  const [range, setRange] = useState<[number, number]>([0, 100]);

  const isMobile = useIsMobile();

  const bounds = useMemo<[number, number]>(() => {
    if (!districts) return [0, 100];
    const vals = districts.features.map((f) => f.properties.pill_total);
    return [0, Math.ceil(Math.max(...vals))];
  }, [districts]);

  useEffect(() => {
    setRange(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorKey, districts]);

  const visibleUids = useMemo<Set<string> | null>(() => {
    if (!districts) return null;
    const regionFiltering = activeRegions.size > 0;
    const rangeFiltering = range[0] > bounds[0] || range[1] < bounds[1];
    if (!regionFiltering && !rangeFiltering) return null;

    const set = new Set<string>();
    for (const f of districts.features) {
      const region = STATE_REGION[f.properties.state];
      const value = f.properties.pill_total;
      const regionOk = !regionFiltering || (region && activeRegions.has(region));
      const rangeOk = value >= range[0] && value <= range[1];
      if (regionOk && rangeOk) set.add(f.properties.uid);
    }
    return set;
  }, [districts, activeRegions, range, bounds]);

  function selectDistrict(uid: string | null) {
    setSelectedUid(uid);
    if (uid && districts) {
      const f = districts.features.find((ft) => ft.properties.uid === uid);
      if (f?.properties.bbox) setFlyToBbox([...f.properties.bbox]);
    }
  }

  function toggleRegion(r: Region) {
    setActiveRegions((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }

  function resetFilters() {
    setActiveRegions(new Set());
    setRange(bounds);
  }

  const selectedFeature: DistrictFeature | null = useMemo(() => {
    if (!districts || !selectedUid) return null;
    return districts.features.find((f) => f.properties.uid === selectedUid) ?? null;
  }, [districts, selectedUid]);

  const hoveredFeature: DistrictFeature | null = useMemo(() => {
    if (!districts || !hover.uid) return null;
    return districts.features.find((f) => f.properties.uid === hover.uid) ?? null;
  }, [districts, hover.uid]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-400">
        Failed to load atlas data: {error}
      </div>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-bg">
      {districts && (
        <IndiaMap
          districts={districts}
          dots={dots}
          selectedUid={selectedUid}
          visibleUids={visibleUids}
          onSelectDistrict={selectDistrict}
          onHoverDistrict={(uid, x, y) => setHover({ uid, x, y })}
          flyToBbox={flyToBbox}
        />
      )}

      {!isMobile && hoveredFeature && (
        <HoverTooltip feature={hoveredFeature} x={hover.x} y={hover.y} />
      )}

      {/* Top overlay: title + search + filter toggle */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-border bg-panel/80 px-3 py-2 backdrop-blur-sm sm:flex">
            <MapPin size={16} className="text-glowPink" />
            <span className="text-sm font-semibold text-text-primary">
              India Family Planning Atlas
            </span>
          </div>
          <div className="flex-1">
            {districts && <SearchBar features={districts.features} onSelect={selectDistrict} />}
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`shrink-0 rounded-xl border p-2.5 backdrop-blur-sm ${
              filtersOpen
                ? "border-glowPink/60 bg-glowPink/15 text-glowPink"
                : "border-border bg-panel/80 text-text-secondary"
            }`}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {meta && indicators && (
          <div className="pointer-events-auto max-w-xl">
            <StatsCards stats={meta[indicatorKey]} />
          </div>
        )}

        {filtersOpen && indicators && (
          <div className="pointer-events-auto max-w-xs">
            <FilterPanel
              indicators={indicators}
              indicatorKey={indicatorKey}
              onIndicatorChange={(k) => {
                setIndicatorKey(k);
                setSelectedUid(null);
              }}
              activeRegions={activeRegions}
              onToggleRegion={toggleRegion}
              range={range}
              bounds={bounds}
              onRangeChange={setRange}
              onReset={resetFilters}
            />
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 z-10 hidden flex-col gap-2 sm:flex">
        <Legend />
        {leaderboard && <Leaderboard entries={leaderboard} />}
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
          <div className="text-sm text-text-secondary">Loading NFHS-5 district atlas…</div>
        </div>
      )}

      {/* Desktop side panel */}
      {!isMobile && selectedFeature && meta && leaderboard && (
        <div className="absolute right-0 top-0 z-20 h-full w-[380px] border-l border-border bg-panel/95 shadow-glow backdrop-blur-md">
          <DistrictPanel
            feature={selectedFeature}
            meta={meta[indicatorKey]}
            leaderboard={leaderboard}
            onClose={() => selectDistrict(null)}
          />
        </div>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <BottomSheet open={!!selectedFeature} onClose={() => selectDistrict(null)}>
          {selectedFeature && meta && leaderboard && (
            <DistrictPanel
              feature={selectedFeature}
              meta={meta[indicatorKey]}
              leaderboard={leaderboard}
              onClose={() => selectDistrict(null)}
            />
          )}
        </BottomSheet>
      )}
    </main>
  );
}
