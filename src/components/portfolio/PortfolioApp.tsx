"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Lädt das Portfolio-Modul (public/portfolio-app): Markup, Styles und das Dashboard in sechs Teilen (APP_PARTS, Reihenfolge wichtig:
 * p0 Konstanten, p1 Laufzeit und Berechnungen, p2a/p2b Seiten, p3 Zusatzfunktionen, p4 Export, Regionen-Umschalter und Start).
 * Die Sprache (de/en) folgt dem Sprachwahlschalter von Orbit: auf Englisch kommt app.en.html und das Wörterbuch i18n-en.json (Hilfen in i18n.js, siehe docs/PORTFOLIO.md).
 * Die Daten kommen aus /api/portfolio/* – serverseitig mit den Zugängen aus Railway, nie im Browser.
 * d3 kommt fest versioniert mit Integritätsprüfung von jsDelivr.
 */
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js";
const D3_SRI = "sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i";
const APP_PARTS = ["p0", "p1", "p2a", "p2b", "p3", "p4"];

type Win = Window & {
  d3?: unknown;
  EV?: { booted?: boolean };
  ORBIT_PORTFOLIO_CAN_EDIT?: boolean;
  ORBIT_PORTFOLIO_LOCALE?: string;
  ORBIT_PORTFOLIO_EN?: Record<string, string>;
};

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

type MdvStatus = { connected: boolean; team?: string | null; connected_by?: string; connected_at?: string; error?: string | null };

/** Stand der eigenen myDataValue-Anmeldung; mit Pflegerechten verbinden, neu verbinden oder trennen. */
function MdvBar({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("platform.portfolio.mdv");
  const [st, setSt] = useState<MdvStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/portfolio/mdv/status", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSt(j))
      .catch(() => setSt(null));
  useEffect(() => {
    load();
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || (e.data as { type?: string })?.type !== "orbit-mdv") return;
      load();
      // Daten mit der neuen Verbindung neu laden
      if ((e.data as { ok?: boolean }).ok) fetch("/api/portfolio/data?refresh=1", { credentials: "same-origin" }).finally(() => window.location.reload());
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  if (!st) return null;
  const connect = () => {
    const w = window.open("/api/portfolio/mdv/connect", "orbit-mdv", "width=520,height=720");
    if (!w) window.location.href = "/api/portfolio/mdv/connect";
  };
  const disconnect = async () => {
    if (!window.confirm(t("confirmDisconnect"))) return;
    setBusy(true);
    await fetch("/api/portfolio/mdv/status", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    setBusy(false);
    load();
  };
  const btn: React.CSSProperties = { marginLeft: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #cca67d", background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" };
  const text = st.connected
    ? `${t("connected")}${st.team ? t("team", { team: st.team }) : ""}${st.connected_by ? t("by", { name: st.connected_by }) : ""}`
    : st.error
      ? t("error", { error: st.error })
      : t("notConnected");
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, padding: "8px 24px", fontSize: 13, opacity: 0.9, borderBottom: "1px solid rgba(204,166,125,0.25)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: st.connected ? "#6fbf73" : "#e5806b", marginRight: 8 }} />
      <span>{text}</span>
      {canEdit && !st.connected && (
        <button type="button" style={btn} onClick={connect}>
          {t("connect")}
        </button>
      )}
      {canEdit && st.connected && (
        <button type="button" style={{ ...btn, borderColor: "rgba(204,166,125,0.4)", opacity: 0.8 }} onClick={disconnect} disabled={busy}>
          {t("disconnect")}
        </button>
      )}
    </div>
  );
}

export function PortfolioApp({ canEdit, version, locale }: { canEdit: boolean; version: string; locale: string }) {
  const t = useTranslations("platform.portfolio");
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
        const en = locale === "en";
        w.ORBIT_PORTFOLIO_LOCALE = en ? "en" : "de";
        if (en) {
          const dict = await fetch(`/portfolio-app/i18n-en.json?v=${version}`, { credentials: "same-origin" });
          if (!dict.ok) throw new Error(`HTTP ${dict.status}`);
          w.ORBIT_PORTFOLIO_EN = await dict.json();
        }
        const res = await fetch(`/portfolio-app/${en ? "app.en.html" : "app.html"}?v=${version}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (cancelled || !root.current) return;
        root.current.innerHTML = html;
        if (!w.d3) await loadScript(D3_URL, D3_SRI);
        await loadScript(`/portfolio-app/i18n.js?v=${version}`);
        for (const part of APP_PARTS) await loadScript(`/portfolio-app/app-${part}.min.js?v=${version}`);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, version, locale]);

  return (
    <>
      <link rel="stylesheet" href={`/portfolio-app/theme.css?v=${version}`} precedence="default" />
      <link rel="stylesheet" href={`/portfolio-app/app.css?v=${version}`} precedence="default" />
      <MdvBar canEdit={canEdit} />
      {!ready && <p style={{ padding: "24px", opacity: 0.7 }}>{error ? t("loadError", { error }) : t("loading")}</p>}
      {/* Inhalt wird vom Dashboard-Skript gesetzt; React verwaltet dieses Element nicht weiter */}
      <div id="dash-root" ref={root} suppressHydrationWarning />
    </>
  );
}
