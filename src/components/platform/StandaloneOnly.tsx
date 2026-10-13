"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Zeigt den Inhalt nur, wenn die Seite NICHT in Orbit eingebettet ist (z. B. "← Orbit").
 * Geprüft im Browser statt auf dem Server: Safari auf iOS schickt den Header, an dem der Server
 * das Einbetten erkennt, bei Seitenwechseln im Tab nicht zuverlässig mit.
 */
export function StandaloneOnly({ children }: { children: ReactNode }) {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    try {
      setStandalone(window.self === window.top);
    } catch {
      setStandalone(false); // Zugriff auf window.top verweigert: eingebettet
    }
  }, []);
  return standalone ? <>{children}</> : null;
}
