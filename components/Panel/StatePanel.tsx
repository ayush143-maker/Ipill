"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import type { IndicatorNationalStats, StateFeature } from "@/lib/types";
import { STATE_REGION } from "@/lib/regions";

interface StatePanelProps {
  feature: StateFeature;
  meta: IndicatorNationalStats;
  onClose: () => void;
}

export default function StatePanel({ feature, meta, onClose }: StatePanelProps) {
  const props = feature.properties;
  const value = props.pill_total;
  const diffFromAvg = +(value - meta.national_average).toFixed(1);
  const rank = meta.ranks[props.state];
  const region = STATE_REGION[props.state] ?? "—";

  const trendData =
    props.pill_nfhs4 != null
      ? [
          { round: "NFHS-4 (2015–16)", value: props.pill_nfhs4 },
          { round: "NFHS-5 (2019–21)", value },
        ]
      : [];

  const compareData = [
    { name: "Rural", value: props.pill_rural },
    { name: "Urban", value: props.pill_urban },
    { name: "National", value: meta.national_average },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {region} · India
          </div>
          <h2 className="text-xl font-semibold text-text-primary">{props.state}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-text-muted hover:bg-white/5 hover:text-text-primary"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            Oral Contraceptive Pill use
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-bold text-glowPink">{value}%</span>
            <span
              className={`mb-1 text-sm ${diffFromAvg >= 0 ? "text-emerald-400" : "text-orange-400"}`}
            >
              {diffFromAvg >= 0 ? "+" : ""}
              {diffFromAvg} pts vs national avg
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase text-text-muted">National Rank</div>
            <div className="text-lg font-semibold text-text-primary">
              {rank ? `#${rank} of ${meta.count}` : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase text-text-muted">National Average</div>
            <div className="text-lg font-semibold text-text-primary">
              {meta.national_average}%
            </div>
          </div>
        </div>

        {(props.highest_district || props.lowest_district) && (
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">
              Within {props.state} ({props.district_count_in_state} districts)
            </div>
            <div className="space-y-1.5">
              {props.highest_district && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-black/20 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <TrendingUp size={13} className="text-glowPink" />
                    Highest: {props.highest_district}
                  </span>
                  <span className="text-xs font-semibold text-text-primary">
                    {props.highest_district_value}%
                  </span>
                </div>
              )}
              {props.lowest_district && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-black/20 px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <TrendingDown size={13} className="text-text-muted" />
                    Lowest: {props.lowest_district}
                  </span>
                  <span className="text-xs font-semibold text-text-primary">
                    {props.lowest_district_value}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">
            Urban vs Rural vs National
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" hide domain={[0, "dataMax + 5"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={64}
                  tick={{ fill: "#9C9CB5", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {compareData.map((d, i) => (
                    <Cell key={d.name} fill={i === 2 ? "#6B6B85" : "#ff2fb0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {trendData.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">
              Trend: NFHS-4 → NFHS-5
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ left: 0, right: 0 }}>
                  <XAxis
                    dataKey="round"
                    tick={{ fill: "#9C9CB5", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, "dataMax + 5"]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36} fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-text-muted">
          Source: National Family Health Survey-5 (2019–21), Ministry of Health &amp; Family
          Welfare, Government of India. This is oral contraceptive pill use, not emergency
          contraception ("i-Pill") — NFHS does not publish emergency contraceptive use at any
          level. The state figure above is the real NFHS-5 survey estimate; the highest/lowest
          district figures and the dot density on the map are computed from the underlying
          district-level data. Dot positions are randomized within each district for visual
          texture only.
        </p>
      </div>
    </div>
  );
}
