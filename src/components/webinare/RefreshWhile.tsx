"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lädt die Seite in Abständen neu, solange etwas läuft (z. B. ein Render-Auftrag). */
export function RefreshWhile({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
