"use client";

import type { DistrictFeature } from "@/lib/types";

interface HoverTooltipProps {
  feature: DistrictFeature | null;
  x: number;
  y: number;
}

export default function HoverTooltip({ feature, x, y }: HoverTooltipProps) {
  if (!feature) return null;
  const { district, state, pill_total } = feature.properties;

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs shadow-glow-sm"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="font-semibold text-text-primary">{district}</div>
      <div className="text-text-muted">{state}</div>
      <div className="text-text-secondary">
        Pill use: <span className="text-glowPink">{pill_total}%</span>
      </div>
    </div>
  );
}
