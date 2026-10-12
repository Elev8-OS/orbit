"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Als Tab in Orbit: übernimmt Darstellung (Hell/Dunkel/System) und Sprache, sobald sie in Orbit
 * umgestellt werden. Orbit schickt dazu eine "orbit:prefs"-Nachricht an den Tab.
 */
export function PrefsListener() {
  const router = useRouter();
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; locale?: string; themePreference?: string } | null;
      if (!data || data.type !== "orbit:prefs") return;
      if (data.themePreference && ["system", "light", "dark"].includes(data.themePreference)) {
        document.documentElement.dataset.theme = data.themePreference;
      }
      if (data.locale && data.locale !== document.documentElement.lang) router.refresh();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
