"use client";

import { ALL_REGIONS } from "@/lib/regions";
import type { IndicatorMeta, Region } from "@/lib/types";

interface FilterPanelProps {
  indicators: IndicatorMeta[];
  indicatorKey: string;
  onIndicatorChange: (key: string) => void;
  activeRegions: Set<Region>;
  onToggleRegion: (region: Region) => void;
  range: [number, number];
  bounds: [number, number];
  onRangeChange: (range: [number, number]) => void;
  onReset: () => void;
}

export default function FilterPanel({
  indicators,
  indicatorKey,
  onIndicatorChange,
  activeRegions,
  onToggleRegion,
  range,
  bounds,
  onRangeChange,
  onReset,
}: FilterPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-panel/80 p-3 backdrop-blur-sm">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
          Indicator
        </label>
        <select
          value={indicatorKey}
          onChange={(e) => onIndicatorChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-glowPink"
        >
          {indicators.map((ind) => (
            <option key={ind.key} value={ind.key}>
              {ind.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
          Region
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_REGIONS.map((r) => {
            const active = activeRegions.has(r);
            return (
              <button
                key={r}
                onClick={() => onToggleRegion(r)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-glowPink/60 bg-glowPink/15 text-glowPink"
                    : "border-border text-text-secondary hover:border-text-muted"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-text-muted">
          <span>Prevalence range</span>
          <span className="text-text-secondary">
            {range[0]}% – {range[1]}%
          </span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={bounds[0]}
            max={bounds[1]}
            step={0.1}
            value={range[0]}
            onChange={(e) =>
              onRangeChange([Math.min(Number(e.target.value), range[1]), range[1]])
            }
            className="w-full accent-glowPink"
          />
          <input
            type="range"
            min={bounds[0]}
            max={bounds[1]}
            step={0.1}
            value={range[1]}
            onChange={(e) =>
              onRangeChange([range[0], Math.max(Number(e.target.value), range[0])])
            }
            className="w-full accent-glowPink"
          />
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full rounded-lg border border-border py-1.5 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary"
      >
        Reset filters
      </button>
    </div>
  );
}
