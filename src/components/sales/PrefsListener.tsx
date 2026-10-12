"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Als Orbit-Tab: Hell/Dunkel und Sprache übernehmen, wenn sie in Orbit umgestellt werden ("orbit:prefs"). */
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
