"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { useShell } from "./OrbitShell";

/**
 * Puls im Kopf der Übersicht: drei Kennzahl-Kacheln (frei wählbar aus allen Apps mit Berechtigung)
 * und eine Kachel "Für dich" mit bis zu drei offenen Punkten. Die Auswahl merkt sich der Browser.
 */
type L = { de: string; en: string };
type Metric = { id: string; label: L; value: string; detail?: L; path?: string };
type Action = { id: string; tone: "red" | "amber" | "info"; text: L; path?: string };
type AppPulse = { app: string; name: L; metrics: Metric[]; actions: Action[] };
type Item = Metric & { key: string; app: string; appName: string };

const SLOTS_KEY = "orbit:pulse-slots";
const SLOT_COUNT = 3;
const TEXT = {
  de: { forYou: "Für dich", choose: "Kennzahl wählen", pulse: "Kennzahlen", allClear: "Alles im grünen Bereich.", in: "in" },
  en: { forYou: "For you", choose: "Choose metric", pulse: "Key figures", allClear: "All clear.", in: "in" }
};
const TONE_RANK = { red: 0, amber: 1, info: 2 } as const;

function readSlots(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function Pulse({ locale }: { locale: string }) {
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = TEXT[lang];
  const shell = useShell();
  const [data, setData] = useState<AppPulse[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [menu, setMenu] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSaved(readSlots());
    let alive = true;
    fetch("/api/pulse")
      .then((r) => (r.ok ? r.json() : { apps: [] }))
      .then((d: { apps: AppPulse[] }) => alive && setData(d.apps ?? []))
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
  }, []);

  // Menü schliessen bei Klick daneben oder Escape
  useEffect(() => {
    if (menu === null) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(`[data-slot="${menu}"]`)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const items: Item[] = useMemo(
    () => (data ?? []).flatMap((a) => a.metrics.map((m) => ({ ...m, key: `${a.app}:${m.id}`, app: a.app, appName: a.name[lang] }))),
    [data, lang]
  );
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  // Gespeicherte Wahl, wo vorhanden; Rest mit den ersten noch freien Kennzahlen auffüllen
  const slots = useMemo(() => {
    const chosen = saved.filter((k) => byKey.has(k)).slice(0, SLOT_COUNT);
    for (const item of items) {
      if (chosen.length >= SLOT_COUNT) break;
      if (!chosen.includes(item.key)) chosen.push(item.key);
    }
    return chosen;
  }, [saved, items, byKey]);

  const choose = (slot: number, key: string) => {
    const next = [...slots];
    const other = next.indexOf(key);
    if (other >= 0) next[other] = next[slot]; // bereits gezeigt: Plätze tauschen
    next[slot] = key;
    setSaved(next);
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
    } catch {
      /* ignorieren */
    }
    setMenu(null);
  };

  const open = (app: string, path?: string) => shell?.openApp(app, path);

  if (data === null) {
    return (
      <div className="hero-board" aria-hidden="true">
        <div className="pulse-tile is-loading" />
        <div className="pulse-tile is-loading" />
        <div className="pulse-tile is-loading" />
        <div className="foryou-card is-loading" />
      </div>
    );
  }

  const actions = data
    .flatMap((a) => a.actions.map((x) => ({ ...x, app: a.app, appName: a.name[lang] })))
    .sort((a, b) => (TONE_RANK[a.tone] ?? 2) - (TONE_RANK[b.tone] ?? 2))
    .slice(0, 3);
  if (!items.length && !actions.length) return null;
  const groups = data.filter((a) => a.metrics.length);

  return (
    <div className="hero-board" ref={boardRef}>
      {slots.map((key, slot) => {
        const m = byKey.get(key)!;
        return (
          <div key={slot} className="pulse-tile" data-slot={slot}>
            <button type="button" className="pulse-open" onClick={() => open(m.app, m.path)} title={`${m.appName}`}>
              <span className="pulse-label">{m.label[lang]}</span>
              <span className="pulse-value">{m.value}</span>
              {m.detail && <span className="pulse-detail">{m.detail[lang]}</span>}
              <ArrowUpRight size={14} aria-hidden="true" className="pulse-arrow" />
            </button>
            {items.length > 1 && (
              <button
                type="button"
                className="pulse-pick"
                aria-label={`${t.choose}: ${m.label[lang]}`}
                aria-haspopup="listbox"
                aria-expanded={menu === slot}
                onClick={() => setMenu(menu === slot ? null : slot)}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
            {menu === slot && (
              <div className="pulse-menu" role="listbox" aria-label={t.choose}>
                {groups.map((g) => (
                  <Fragment key={g.app}>
                    <div className="pulse-menu-group">{g.name[lang]}</div>
                    {g.metrics.map((gm) => {
                      const k = `${g.app}:${gm.id}`;
                      const selected = k === key;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className="pulse-menu-item"
                          onClick={() => choose(slot, k)}
                        >
                          <span className="pulse-menu-check" aria-hidden="true">{selected && <Check size={14} />}</span>
                          <span className="pulse-menu-label">{gm.label[lang]}</span>
                          <span className="pulse-menu-value">{gm.value}</span>
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <section className="foryou-card" aria-label={t.forYou}>
        <h2 className="foryou-title">{t.forYou}</h2>
        {actions.length ? (
          <ul>
            {actions.map((a) => (
              <li key={`${a.app}-${a.id}`}>
                <button type="button" className="foryou-item" onClick={() => open(a.app, a.path)} title={`${t.in} ${a.appName}`}>
                  <span className={`foryou-dot tone-${a.tone}`} aria-hidden="true" />
                  <span className="foryou-text">{a.text[lang]}</span>
                  <ArrowUpRight size={14} aria-hidden="true" className="foryou-arrow" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="foryou-empty">{t.allClear}</p>
        )}
      </section>
    </div>
  );
}
