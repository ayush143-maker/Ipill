"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { X } from "lucide-react";
import type { IndicatorMeta, IndicatorNationalStats, StateFeature } from "@/lib/types";
import { STATE_REGION } from "@/lib/regions";

interface StatePanelProps {
  feature: StateFeature;
  indicatorKey: string;
  indicators: IndicatorMeta[];
  meta: IndicatorNationalStats;
  onClose: () => void;
}

export default function StatePanel({
  feature,
  indicatorKey,
  indicators,
  meta,
  onClose,
}: StatePanelProps) {
  const props = feature.properties;
  const value = props[`${indicatorKey}_total`] as number | undefined;
  const urban = props[`${indicatorKey}_urban`] as number | undefined;
  const rural = props[`${indicatorKey}_rural`] as number | undefined;
  const nfhs4 = props[`${indicatorKey}_nfhs4`] as number | undefined;
  const rank = meta.ranks[props.state];
  const diffFromAvg = value != null ? +(value - meta.national_average).toFixed(1) : null;
  const label = indicators.find((i) => i.key === indicatorKey)?.label ?? indicatorKey;
  const region = STATE_REGION[props.state] ?? "—";

  const trendData =
    value != null && nfhs4 != null
      ? [
          { round: "NFHS-5\n(2019–21)", value: nfhs4 },
          { round: "NFHS-6\n(2023–24)", value },
        ]
      : [];

  const compareData = [
    { name: "Rural", value: rural ?? 0 },
    { name: "Urban", value: urban ?? 0 },
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
          <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-bold text-glowPink">{value ?? "—"}%</span>
            {diffFromAvg != null && (
              <span
                className={`mb-1 text-sm ${
                  diffFromAvg >= 0 ? "text-emerald-400" : "text-orange-400"
                }`}
              >
                {diffFromAvg >= 0 ? "+" : ""}
                {diffFromAvg} pts vs national avg
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase text-text-muted">Leaderboard </div>
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
              Trend Forecast !
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
           Source: NFHS and other public health datasets. This visualization represents the estimated distribution of contraceptive use across India, including i-Pill, Unwanted-72, and Mala-D For educational and research purposes only!
       </p>
      </div>
    </div>
  );
}
