"use client";

import { Search } from "lucide-react";
import { openPalette } from "./target";

/** Suche/Noah aus einem Orbit-Tab heraus: öffnet den Dialog im Orbit-Fenster. */
export function PaletteButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="p-app-search"
      onClick={() => {
        if (window.top && window.top !== window) window.top.postMessage({ type: "orbit:palette", mode: "search" }, window.location.origin);
        else openPalette("search");
      }}
    >
      <Search size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
