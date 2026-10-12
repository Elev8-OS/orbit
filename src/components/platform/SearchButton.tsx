"use client";

import { Search, Sparkles } from "lucide-react";
import { openPalette } from "./target";

/** Suche und Noah in der Kopfzeile (öffnet den ⌘K-Dialog). */
export function SearchButton({ label, noahLabel }: { label: string; noahLabel: string }) {
  return (
    <div className="p-sky-actions">
      <button type="button" className="p-sky-search" onClick={() => openPalette("search")}>
        <Search size={16} aria-hidden="true" />
        <span className="p-sky-search-label">{label}</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>
      <button type="button" className="p-sky-noah" onClick={() => openPalette("noah")} aria-label={noahLabel} title={noahLabel}>
        <Sparkles size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
