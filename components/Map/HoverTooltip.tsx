"use client";

import type { IndicatorMeta, StateFeature } from "@/lib/types";

interface HoverTooltipProps {
  feature: StateFeature | null;
  x: number;
  y: number;
  indicatorKey: string;
  indicatorLabel: string;
}

export default function HoverTooltip({
  feature,
  x,
  y,
  indicatorKey,
  indicatorLabel,
}: HoverTooltipProps) {
  if (!feature) return null;
  const value = feature.properties[`${indicatorKey}_total`];

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs shadow-glow-sm"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="font-semibold text-text-primary">{feature.properties.state}</div>
      <div className="text-text-secondary">
        {indicatorLabel}: <span className="text-glowPink">{value ?? "—"}%</span>
      </div>
    </div>
  );
}
