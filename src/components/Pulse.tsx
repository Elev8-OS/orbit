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
      <div className="board" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="board-cell is-loading">
            <span className="skel skel-label" />
            <span className="skel skel-value" />
            <span className="skel skel-detail" />
          </div>
        ))}
        <div className="board-cell board-foryou is-loading">
          <span className="skel skel-label" />
          <span className="skel skel-line" />
          <span className="skel skel-line" />
        </div>
      </div>
    );
  }

  const actions = data
    .flatMap((a) => a.actions.map((x) => ({ ...x, app: a.app, appName: a.name[lang] })))
    .sort((a, b) => (TONE_RANK[a.tone] ?? 2) - (TONE_RANK[b.tone] ?? 2))
    .slice(0, 3);
  if (!items.length && !actions.length) return null;
  const groups = data.filter((a) => a.metrics.length);
  // "Support: Ältestes offenes Ticket …" → Bereich hervorheben, Rest ruhig
  const split = (text: string) => {
    const i = text.indexOf(": ");
    return i > 0 && i < 40 ? [text.slice(0, i), text.slice(i + 2)] : [null, text];
  };

  return (
    <div className="board" ref={boardRef}>
      {slots.map((key, slot) => {
        const m = byKey.get(key)!;
        return (
          <div key={slot} className="board-cell" data-slot={slot}>
            <div className="board-label">
              <span>{m.label[lang]}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  className="board-pick"
                  aria-label={`${t.choose}: ${m.label[lang]}`}
                  aria-haspopup="listbox"
                  aria-expanded={menu === slot}
                  onClick={() => setMenu(menu === slot ? null : slot)}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button type="button" className="board-open" onClick={() => open(m.app, m.path)}>
              <span className="board-value">{m.value}</span>
              <span className="board-detail">
                {m.detail?.[lang] ?? m.appName}
                <ArrowUpRight size={14} aria-hidden="true" className="board-arrow" />
              </span>
              <span className="sr-only">{m.appName}</span>
            </button>
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
      <section className="board-cell board-foryou" aria-label={t.forYou}>
        <h2 className="board-label">{t.forYou}</h2>
        {actions.length ? (
          <ul>
            {actions.map((a) => {
              const [area, rest] = split(a.text[lang]);
              return (
                <li key={`${a.app}-${a.id}`}>
                  <button type="button" className="foryou-item" onClick={() => open(a.app, a.path)} title={`${t.in} ${a.appName}`}>
                    <span className={`foryou-dot tone-${a.tone}`} aria-hidden="true" />
                    <span className="foryou-text">
                      {area && <strong>{area}</strong>}
                      {area && <span className="foryou-sep"> · </span>}
                      {rest}
                    </span>
                    <ArrowUpRight size={14} aria-hidden="true" className="foryou-arrow" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="foryou-empty">{t.allClear}</p>
        )}
      </section>
    </div>
  );
}
