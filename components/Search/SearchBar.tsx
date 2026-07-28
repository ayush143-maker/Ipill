"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import type { StateFeature } from "@/lib/types";

interface SearchBarProps {
  features: StateFeature[];
  onSelect: (stateName: string) => void;
}

export default function SearchBar({ features, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const fuse = useMemo(
    () =>
      new Fuse(features, {
        keys: ["properties.state"],
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
          placeholder="Search state or union territory..."
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
              key={r.item.properties.state}
              onClick={() => {
                onSelect(r.item.properties.state);
                setQuery("");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-white/5"
            >
              {r.item.properties.state}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
