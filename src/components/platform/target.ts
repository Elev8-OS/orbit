"use client";

import { useCallback } from "react";
import { useShell } from "@/components/OrbitShell";

export type Target = { app: string; path?: string } | { href: string };

/**
 * Öffnet ein Ziel aus Mein Tag, Suche, Noah oder Kunden-360:
 * - in Orbit selbst als Tab,
 * - aus einem eingebetteten Tab heraus über Orbit (Nachricht "orbit:open" an das Orbit-Fenster),
 * - sonst über die Startseite mit ?app=…&path=….
 */
export function useOpenTarget() {
  const shell = useShell();
  return useCallback(
    (target: Target) => {
      if ("href" in target) {
        if (window.top && window.top !== window) window.top.location.href = target.href;
        else window.location.href = target.href;
        return;
      }
      if (shell?.openApp(target.app, target.path)) return;
      if (window.top && window.top !== window) {
        window.top.postMessage({ type: "orbit:open", app: target.app, path: target.path ?? null }, window.location.origin);
        return;
      }
      const url = new URL("/", window.location.origin);
      url.searchParams.set("app", target.app);
      if (target.path) url.searchParams.set("path", target.path);
      window.location.href = url.toString();
    },
    [shell]
  );
}

export const PALETTE_EVENT = "orbit:palette";
/** Öffnet die Suche (⌘K), optional direkt im Noah-Modus. */
export function openPalette(mode: "search" | "noah" = "search") {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: { mode } }));
}
