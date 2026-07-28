"use client";

export default function Legend() {
  return (
    <div className="pointer-events-none flex items-center gap-3 rounded-xl border border-border bg-panel/80 px-3 py-2 text-[11px] text-text-secondary backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-glowPink/50 shadow-[0_0_6px_rgba(255,47,176,0.6)]" />
        Sparse
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-glowPink shadow-[0_0_6px_rgba(255,47,176,0.9)]" />
        <span className="h-2 w-2 rounded-full bg-glowPink shadow-[0_0_8px_rgba(255,47,176,0.9)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-glowPink shadow-[0_0_10px_rgba(255,47,176,1)]" />
      </span>
      Dense
      <span className="ml-1 text-text-muted">— each dot cluster is proportional to prevalence</span>
    </div>
  );
}
