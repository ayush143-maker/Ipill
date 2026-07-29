"use client";

import type { IndicatorNationalStats } from "@/lib/types";

export default function StatsCards({ stats }: { stats: IndicatorNationalStats }) {
  const cards = [
    { label: "National Average", value: `${stats.national_average}%` },
    { label: "Most Prepared", value: `${stats.highest.value}%`, sub: stats.highest.state },
    { label: "Shit yawr", value: `${stats.lowest.value}%`, sub: stats.lowest.state },
    { label: "States / UTs", value: String(stats.count) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-panel/70 px-3 py-2.5 backdrop-blur-sm"
        >
          <div className="text-[10px] uppercase tracking-wide text-text-muted">{c.label}</div>
          <div className="mt-0.5 text-lg font-semibold text-text-primary">{c.value}</div>
          {c.sub && (
            <div className="truncate text-[11px] text-text-secondary" title={c.sub}>
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
