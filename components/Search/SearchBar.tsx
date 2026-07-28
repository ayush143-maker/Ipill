"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import type { DistrictFeature } from "@/lib/types";

interface SearchBarProps {
  features: DistrictFeature[];
  onSelect: (uid: string) => void;
}

export default function SearchBar({ features, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const fuse = useMemo(
    () =>
      new Fuse(features, {
        keys: ["properties.district", "properties.state"],
        threshold: 0.35,
      }),
    [features]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 8);
  }, [query, fuse]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-panel/80 px-3 py-2 backdrop-blur-sm">
        <Search size={16} className="shrink-0 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search district or state..."
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search">
            <X size={14} className="text-text-muted hover:text-text-primary" />
          </button>
        )}
      </div>

      {focused && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-panel shadow-glow-sm">
          {results.map((r) => (
            <button
              key={r.item.properties.uid}
              onClick={() => {
                onSelect(r.item.properties.uid);
                setQuery("");
              }}
              className="flex w-full items-baseline justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
            >
              <span className="text-text-primary">{r.item.properties.district}</span>
              <span className="ml-2 text-xs text-text-muted">{r.item.properties.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
