"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lädt das Portfolio-Modul (public/portfolio-app): Markup, Styles und das gebündelte Dashboard-Skript (app-a: Laufzeit und Grundseiten, app-b: Zusatzfunktionen und Export).
 * Die Daten kommen aus /api/portfolio/* – serverseitig mit den Zugängen aus Railway, nie im Browser.
 * d3 kommt fest versioniert mit Integritätsprüfung von jsDelivr.
 */
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js";
const D3_SRI = "sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i";

type Win = Window & { d3?: unknown; EV?: { booted?: boolean }; ORBIT_PORTFOLIO_CAN_EDIT?: boolean };

function loadScript(src: string, integrity?: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    if (integrity) {
      s.integrity = integrity;
      s.crossOrigin = "anonymous";
    }
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Skript konnte nicht geladen werden: ${src}`));
    document.body.appendChild(s);
  });
}

export function PortfolioApp({ canEdit, version }: { canEdit: boolean; version: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as Win;
    // Das Dashboard läuft einmal pro Seitenaufruf; nach einer Navigation innerhalb von Orbit neu laden
    if (w.EV?.booted) {
      window.location.reload();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        w.ORBIT_PORTFOLIO_CAN_EDIT = canEdit;
        const res = await fetch(`/portfolio-app/app.html?v=${version}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (cancelled || !root.current) return;
        root.current.innerHTML = html;
        if (!w.d3) await loadScript(D3_URL, D3_SRI);
        await loadScript(`/portfolio-app/app-a.min.js?v=${version}`);
        await loadScript(`/portfolio-app/app-b.min.js?v=${version}`);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, version]);

  return (
    <>
      <link rel="stylesheet" href={`/portfolio-app/theme.css?v=${version}`} precedence="default" />
      <link rel="stylesheet" href={`/portfolio-app/app.css?v=${version}`} precedence="default" />
      {!ready && <p style={{ padding: "24px", opacity: 0.7 }}>{error ? `Das Portfolio-Modul konnte nicht geladen werden: ${error}` : "Portfolio wird geladen …"}</p>}
      {/* Inhalt wird vom Dashboard-Skript gesetzt; React verwaltet dieses Element nicht weiter */}
      <div id="dash-root" ref={root} suppressHydrationWarning />
    </>
  );
}
