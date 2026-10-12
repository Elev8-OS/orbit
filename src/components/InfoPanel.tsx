"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import "./info-panel.css";

/**
 * Info-Panel (ⓘ): Neuigkeiten und Glossar der geöffneten App bzw. von Orbit.
 * Die Inhalte liefert jede App selbst unter /orbit-meta.json (Format siehe README, Abschnitt Info-Panel).
 * Texte des Panels liegen hier statt in messages/, damit es unabhängig von anderen Modulen bleibt.
 */
type L = { de: string; en: string };
export type OrbitMeta = {
  changelog?: { version: string; date?: string; title?: L; changes: L[] }[];
  glossary?: { term: string; name?: L; group?: L; definition: L }[];
};

const TEXT = {
  de: { news: "Neuigkeiten", glossary: "Glossar", close: "Schliessen", search: "Begriff suchen", noMatch: "Kein Begriff gefunden.", loading: "Wird geladen …", empty: "Für diese App gibt es noch keine Einträge.", error: "Die Infos konnten nicht geladen werden.", info: "Infos zu" },
  en: { news: "What's new", glossary: "Glossary", close: "Close", search: "Search terms", noMatch: "No matching term.", loading: "Loading …", empty: "No entries for this app yet.", error: "Couldn't load the information.", info: "About" }
};

const cache = new Map<string, Promise<OrbitMeta | null>>();
export function loadMeta(id: string): Promise<OrbitMeta | null> {
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`/api/apps/${encodeURIComponent(id)}/meta`)
        .then((r) => (r.ok ? (r.json() as Promise<OrbitMeta>) : null))
        .catch(() => null)
    );
  }
  return cache.get(id)!;
}

/** Neueste Version einer App, für den Hinweis-Punkt am ⓘ-Knopf. */
export const latestVersion = (meta: OrbitMeta | null) => meta?.changelog?.[0]?.version ?? null;
const seenKey = (id: string) => `orbit:seen:${id}`;
export function hasUnseen(id: string, meta: OrbitMeta | null): boolean {
  const v = latestVersion(meta);
  if (!v) return false;
  try {
    return localStorage.getItem(seenKey(id)) !== v;
  } catch {
    return false;
  }
}
function markSeen(id: string, meta: OrbitMeta | null) {
  const v = latestVersion(meta);
  try {
    if (v) localStorage.setItem(seenKey(id), v);
  } catch {
    /* ignorieren */
  }
}

function formatDate(date: string | undefined, locale: "de" | "en") {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "long", year: "numeric" });
}

type Props = {
  open: boolean;
  appId: string;
  appName: string;
  locale: string;
  onClose: () => void;
  onSeen?: () => void;
};

export function InfoPanel({ open, appId, appName, locale, onClose, onSeen }: Props) {
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = TEXT[lang];
  const [tab, setTab] = useState<"news" | "glossary">("news");
  const [state, setState] = useState<{ id: string; meta: OrbitMeta | null; done: boolean }>({ id: "", meta: null, done: false });
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState((s) => (s.id === appId ? s : { id: appId, meta: null, done: false }));
    setQ("");
    loadMeta(appId).then((meta) => {
      if (!alive) return;
      setState({ id: appId, meta, done: true });
      markSeen(appId, meta);
      onSeen?.();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const glossary = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = [...(state.meta?.glossary ?? [])].sort((a, b) => a.term.localeCompare(b.term, lang));
    if (!needle) return items;
    return items.filter((g) => [g.term, g.name?.[lang], g.definition[lang]].some((s) => s?.toLowerCase().includes(needle)));
  }, [state.meta, q, lang]);

  if (!open) return null;
  const meta = state.id === appId ? state.meta : null;
  const changelog = meta?.changelog ?? [];

  return (
    <>
      <button type="button" className="info-backdrop" aria-label={t.close} onClick={onClose} />
      <aside className="info-panel" role="dialog" aria-modal="true" aria-label={`${t.info} ${appName}`}>
        <header className="info-head">
          <div className="info-title">
            <span className="info-eyebrow">{t.info}</span>
            <h2>{appName}</h2>
          </div>
          <button type="button" className="info-close" onClick={onClose} aria-label={t.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="info-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "news"} onClick={() => setTab("news")}>{t.news}</button>
          <button type="button" role="tab" aria-selected={tab === "glossary"} onClick={() => setTab("glossary")}>{t.glossary}</button>
        </div>

        <div className="info-body">
          {!state.done || state.id !== appId ? (
            <p className="info-note">{t.loading}</p>
          ) : !meta ? (
            <p className="info-note">{t.error}</p>
          ) : tab === "news" ? (
            changelog.length === 0 ? (
              <p className="info-note">{t.empty}</p>
            ) : (
              <ol className="info-news">
                {changelog.map((e, i) => (
                  <li key={e.version}>
                    <div className="info-news-meta">
                      <span className={`info-version${i === 0 ? " is-latest" : ""}`}>{e.version}</span>
                      <span>{formatDate(e.date, lang)}</span>
                    </div>
                    {e.title && <h3>{e.title[lang]}</h3>}
                    <ul>
                      {e.changes.map((c, j) => (
                        <li key={j}>{c[lang]}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <>
              <label className="info-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">{t.search}</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} />
              </label>
              {glossary.length === 0 ? (
                <p className="info-note">{(meta.glossary ?? []).length ? t.noMatch : t.empty}</p>
              ) : (
                <dl className="info-glossary">
                  {glossary.map((g) => (
                    <div key={g.term}>
                      <dt>
                        {g.term}
                        {g.name && g.name[lang] !== g.term && <span>{g.name[lang]}</span>}
                      </dt>
                      <dd>{g.definition[lang]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
