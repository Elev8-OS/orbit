"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Info, LayoutGrid, RotateCw, Search, X } from "lucide-react";
import { InfoPanel, hasUnseen, loadMeta } from "./InfoPanel";
import { CommandPalette } from "./platform/CommandPalette";
import { openPalette } from "./platform/target";
import "./tabbar-dnd.css";
import { PREFS_EVENT, type PrefsDetail, type Theme } from "@/lib/prefs";

export type ShellApp = {
  id: string;
  name: string;
  url: string;
  color: string;
  icon: ReactNode;
};

type ShellContextValue = {
  /** Öffnet eine App als Tab (optional an einem Pfad). Gibt false zurück, wenn die App nicht eingebettet werden kann. */
  openApp: (id: string, path?: string | null) => boolean;
  isEmbedded: (id: string) => boolean;
};

const ShellContext = createContext<ShellContextValue | null>(null);
export const useShell = () => useContext(ShellContext);

const TABS_KEY = "orbit:tabs";
const PASS_REFRESH_MS = 20 * 60 * 1000;
const REAUTH_COOLDOWN_MS = 60 * 1000;

type Props = {
  apps: ShellApp[];
  initialApp: string | null;
  initialPath: string | null;
  locale: string;
  theme: Theme;
  children: ReactNode;
};

function readUrl(): { app: string | null; path: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { app: params.get("app"), path: params.get("path") };
}

function writeUrl(app: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.searchParams.delete("path");
  if (app) url.searchParams.set("app", app);
  else url.searchParams.delete("app");
  const target = url.pathname + url.search + url.hash;
  if (target === window.location.pathname + window.location.search + window.location.hash) return;
  if (mode === "push") window.history.pushState(window.history.state, "", target);
  else window.history.replaceState(window.history.state, "", target);
}

/** Pfad innerhalb der App nur übernehmen, wenn er wirklich ein interner Pfad ist. */
function frameSrc(app: ShellApp, path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return app.url;
  const base = new URL(app.url);
  return new URL(path, base.origin).toString();
}

export function OrbitShell({ apps, initialApp, initialPath, locale, theme, children }: Props) {
  const t = useTranslations("shell");
  const tSearch = useTranslations("platform.header");
  const byId = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const origins = useMemo(() => new Map(apps.map((a) => [new URL(a.url).origin, a.id])), [apps]);

  const [tabs, setTabs] = useState<string[]>([]);
  const tabsRef = useRef<string[]>([]);
  tabsRef.current = tabs;
  const [active, setActive] = useState<string | null>(null);
  const [passReady, setPassReady] = useState(false);
  const [passError, setPassError] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [srcs, setSrcs] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState<Record<string, number>>({});
  const lastPass = useRef(0);
  const lastReauth = useRef<Record<string, number>>({});
  const prefs = useRef<{ locale: string; theme: Theme }>({ locale, theme });
  const [infoOpen, setInfoOpen] = useState(false);
  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [infoNews, setInfoNews] = useState(false);

  // Tabs ziehen nur mit Maus/Trackpad: Auf Touch-Geräten (iOS Safari) startet ein Antippen sonst
  // das Ziehen, und der Tipp zum Wechseln des Tabs kommt nie an.
  const [canDrag, setCanDrag] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanDrag(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // ── Sprache und Darstellung an alle offenen Tools weitergeben ──────────
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const send = () => {
      const { locale: l, theme: t } = prefs.current;
      const resolved = t === "system" ? (media.matches ? "dark" : "light") : t;
      for (const app of apps) {
        const frame = document.getElementById(`frame-${app.id}`) as HTMLIFrameElement | null;
        frame?.contentWindow?.postMessage({ type: "orbit:prefs", locale: l, theme: resolved, themePreference: t }, new URL(app.url).origin);
      }
    };
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<PrefsDetail>).detail ?? {};
      prefs.current = { ...prefs.current, ...detail };
      send();
    };
    const onSystem = () => prefs.current.theme === "system" && send();
    window.addEventListener(PREFS_EVENT, onChange);
    media.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener(PREFS_EVENT, onChange);
      media.removeEventListener("change", onSystem);
    };
  }, [apps]);

  // ── Orbit-Pass holen und regelmässig erneuern ──────────────────
  const refreshPass = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/pass", { method: "POST", cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/signin";
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      lastPass.current = Date.now();
      setPassError(false);
      return true;
    } catch (err) {
      console.error("Orbit-Pass nicht erneuert:", err);
      setPassError(true);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshPass().then((ok) => ok && setPassReady(true));
    const interval = window.setInterval(refreshPass, PASS_REFRESH_MS);
    const onFocus = () => Date.now() - lastPass.current > PASS_REFRESH_MS && refreshPass();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshPass]);

  // ── Tabs öffnen, wechseln, schliessen ─────────────────────────
  const openApp = useCallback(
    (id: string, path: string | null = null, mode: "push" | "replace" = "push") => {
      const app = byId.get(id);
      if (!app) return false;
      setTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setSrcs((prev) => (prev[id] && !path ? prev : { ...prev, [id]: frameSrc(app, path) }));
      // Ausdrücklicher Pfad bei bereits offenem Tab: neu laden, damit der Tab sicher dorthin wechselt
      if (path) setReloadKey((prev) => (prev[id] === undefined && !tabsRef.current.includes(id) ? prev : { ...prev, [id]: (prev[id] ?? 0) + 1 }));
      // Nutzung melden (pro Stunde und App einmal gezählt)
      try {
        navigator.sendBeacon?.("/api/usage", new Blob([JSON.stringify({ app: id })], { type: "application/json" }));
      } catch {
        /* nicht kritisch */
      }
      setLoading((prev) => (prev[id] === undefined ? { ...prev, [id]: true } : prev));
      setActive(id);
      writeUrl(id, mode);
      return true;
    },
    [byId]
  );

  const showHome = useCallback(() => {
    setActive(null);
    writeUrl(null, "push");
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      const next = tabs.filter((x) => x !== id);
      setTabs(next);
      if (active === id) {
        const fallback = next[next.length - 1] ?? null;
        setActive(fallback);
        writeUrl(fallback, "replace");
      }
      setSrcs(({ [id]: _, ...rest }) => rest);
      setLoading(({ [id]: _, ...rest }) => rest);
    },
    [tabs, active]
  );

  const reloadTab = useCallback((id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    setReloadKey((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  // Tabs umsortieren (Drag & Drop oder Alt+Pfeiltaste). Nur die Reihenfolge der Tabs ändert sich,
  // die App-Fenster bleiben im Seitenaufbau stehen, damit keine App neu lädt.
  const moveTab = useCallback((id: string, target: string | number) => {
    setTabs((prev) => {
      const from = prev.indexOf(id);
      const to = typeof target === "number" ? target : prev.indexOf(target);
      if (from < 0 || to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }, []);

  // Beim Laden: geöffnete Tabs dieser Browser-Sitzung wiederherstellen, dann ?app= öffnen
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TABS_KEY) ?? "[]") as string[];
      const valid = saved.filter((id) => byId.has(id));
      if (valid.length) {
        setTabs(valid);
        setSrcs(Object.fromEntries(valid.map((id) => [id, byId.get(id)!.url])));
        setLoading(Object.fromEntries(valid.map((id) => [id, true])));
      }
    } catch {
      /* Speicher nicht verfügbar: ohne Wiederherstellung weiter */
    }
    if (initialApp && byId.has(initialApp)) openApp(initialApp, initialPath, "replace");
    else if (initialApp) writeUrl(null, "replace");
    // nur beim ersten Laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    } catch {
      /* ignorieren */
    }
  }, [tabs]);

  // Zurück/Vor im Browser
  useEffect(() => {
    const onPop = () => {
      const { app } = readUrl();
      if (app && byId.has(app)) openApp(app, null, "replace");
      else setActive(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [byId, openApp]);

  // Ein Tool meldet "Pass abgelaufen": Pass erneuern und den Tab neu laden (höchstens 1× pro Minute)
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const id = origins.get(event.origin);
      if (!id || typeof event.data !== "object" || event.data?.type !== "orbit:reauth") return;
      const now = Date.now();
      if (now - (lastReauth.current[id] ?? 0) < REAUTH_COOLDOWN_MS) {
        setPassError(true);
        return;
      }
      lastReauth.current[id] = now;
      if (await refreshPass()) reloadTab(id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origins, refreshPass, reloadTab]);

  // Eingebettete Apps (und Orbits eigene Seiten im Tab) können andere Apps öffnen: {type: "orbit:open", app, path}
  useEffect(() => {
    const onOpen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && !origins.has(event.origin)) return;
      const data = event.data as { type?: string; app?: unknown; path?: unknown } | null;
      if (!data || data.type !== "orbit:open" || typeof data.app !== "string") return;
      const path = typeof data.path === "string" ? data.path : null;
      if (!openApp(data.app, path)) {
        const url = new URL("/", window.location.origin);
        url.searchParams.set("app", data.app);
        if (path) url.searchParams.set("path", path);
        window.location.href = url.toString();
      }
    };
    window.addEventListener("message", onOpen);
    return () => window.removeEventListener("message", onOpen);
  }, [origins, openApp]);

  // Seitentitel zeigt das aktive Tool
  useEffect(() => {
    document.title = active ? `${byId.get(active)?.name ?? ""} – Orbit` : "Elev8 Orbit";
  }, [active, byId]);

  const ctx = useMemo<ShellContextValue>(
    () => ({ openApp: (id, path) => openApp(id, path ?? null), isEmbedded: (id) => byId.has(id) }),
    [openApp, byId]
  );

  const activeApp = active ? byId.get(active) : null;
  // Info-Panel: Infos zur geöffneten App, auf der Übersicht zu Orbit selbst
  const infoId = activeApp?.id ?? "orbit";
  const infoName = activeApp?.name ?? "Orbit";
  useEffect(() => {
    let alive = true;
    loadMeta(infoId).then((meta) => alive && setInfoNews(hasUnseen(infoId, meta)));
    return () => {
      alive = false;
    };
  }, [infoId]);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  return (
    <ShellContext.Provider value={ctx}>
      {tabs.length > 0 && (
        <nav className="tabbar" aria-label={t("tabs")}>
          <div className="tabbar-scroll" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={active === null}
              className="tab tab-home"
              onClick={showHome}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              <span>{t("home")}</span>
            </button>
            {tabs.map((id) => {
              const app = byId.get(id)!;
              return (
                <div
                  key={id}
                  className={`tab-wrap${active === id ? " is-active" : ""}${dragging === id ? " is-dragging" : ""}`}
                  style={{ "--tile-color": app.color } as CSSProperties}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    dragId.current = id;
                    setDragging(id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                  }}
                  onDragOver={(e) => {
                    if (!dragId.current) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragId.current !== id) moveTab(dragId.current, id);
                  }}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={() => {
                    dragId.current = null;
                    setDragging(null);
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active === id}
                    aria-controls={`frame-${id}`}
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                    title={canDrag ? (locale === "en" ? "Drag to reorder (Alt + ← / →)" : "Ziehen zum Verschieben (Alt + ← / →)") : undefined}
                    className="tab"
                    onClick={() => openApp(id)}
                    onKeyDown={(e) => {
                      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      moveTab(id, tabs.indexOf(id) + (e.key === "ArrowLeft" ? -1 : 1));
                    }}
                  >
                    <span className="tab-icon" aria-hidden="true">{app.icon}</span>
                    <span className="tab-label">{app.name}</span>
                    {loading[id] && <span className="tab-spinner" aria-hidden="true" />}
                  </button>
                  <button type="button" className="tab-close" onClick={() => closeTab(id)} aria-label={t("close", { name: app.name })}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className="tabbar-action" onClick={() => openPalette()} aria-label={tSearch("search")} title={`${tSearch("search")} (⌘K)`}>
            <Search size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tabbar-action tabbar-info"
            onClick={() => setInfoOpen(true)}
            aria-label={`Info: ${infoName}`}
            title={`Info: ${infoName}`}
          >
            <Info size={17} aria-hidden="true" />
            {infoNews && <span className="info-dot" aria-hidden="true" />}
          </button>
          {activeApp && (
            <button type="button" className="tabbar-action" onClick={() => reloadTab(activeApp.id)} aria-label={t("reload")} title={t("reload")}>
              <RotateCw size={16} aria-hidden="true" />
            </button>
          )}
        </nav>
      )}

      <div className="shell-home" hidden={active !== null}>
        {children}
      </div>

      {tabs.length > 0 && (
        <div className={`stage${active ? " is-visible" : ""}${tabs.length ? " has-tabbar" : ""}`}>
          {passError && active && <p className="stage-error" role="alert">{t("passError")}</p>}
          {passReady &&
            [...tabs].sort().map((id) => {
              const app = byId.get(id)!;
              return (
                <div key={id} className="frame-wrap" hidden={active !== id}>
                  {loading[id] && (
                    <div className="frame-loading" role="status">
                      <span className="frame-spinner" aria-hidden="true" />
                      {t("loading", { name: app.name })}
                    </div>
                  )}
                  <iframe
                    key={reloadKey[id] ?? 0}
                    id={`frame-${id}`}
                    title={app.name}
                    src={srcs[id] ?? app.url}
                    /* Kamera nur für den Visitenkarten-Scanner (/scan); alle anderen Apps bekommen sie nicht */
                    allow={`clipboard-read; clipboard-write; fullscreen${id === "scan" ? "; camera" : ""}`}
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={() => setLoading((prev) => ({ ...prev, [id]: false }))}
                  />
                </div>
              );
            })}
        </div>
      )}
      <CommandPalette activeApp={active} />
      <InfoPanel
        open={infoOpen}
        appId={infoId}
        appName={infoName}
        locale={locale}
        onClose={closeInfo}
        onSeen={() => setInfoNews(false)}
      />
    </ShellContext.Provider>
  );
}
