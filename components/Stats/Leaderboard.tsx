"use client";

import type { StateLeaderboardEntry } from "@/lib/types";

export default function Leaderboard({
  entries,
  limit = 5,
}: {
  entries: StateLeaderboardEntry[];
  limit?: number;
}) {
  const top = entries.slice(0, limit);
  const max = top[0]?.avg ?? 1;

  return (
    <div className="w-56 rounded-xl border border-border bg-panel/85 p-3 backdrop-blur-sm">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-text-muted">
        Top {limit} states, avg
      </div>
      <div className="space-y-1.5">
        {top.map((e, i) => (
          <div key={e.state} className="flex items-center gap-2">
            <span className="w-3 text-[11px] text-text-muted">{i + 1}</span>
            <span className="w-20 truncate text-[11px] text-text-secondary" title={e.state}>
              {e.state}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-glowPurple to-glowPink"
                style={{ width: `${(e.avg / max) * 100}%` }}
              />
            </div>
            <span className="w-9 text-right text-[11px] text-text-primary">{e.avg}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
