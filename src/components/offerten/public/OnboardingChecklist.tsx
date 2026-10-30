"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import type { OnboardingItem, OnboardingPhase } from "@/lib/offerten/onboarding";
import type { PublicTexts } from "@/lib/offerten/public-texts";
import { formatDate, type Lang } from "@/lib/offerten/quote";

const PHASES: OnboardingPhase[] = ["start", "setup", "golive"];

/**
 * Checkliste für Kunde (mode "customer": nur eigene und gemeinsame Punkte änderbar) und Team (mode "team": alle).
 * Speichert jeden Haken sofort; bei einem Fehler springt er zurück.
 */
export function OnboardingChecklist({
  items: initial,
  endpoint,
  mode,
  tx,
  lang
}: {
  items: OnboardingItem[];
  endpoint: string;
  mode: "customer" | "team";
  tx: PublicTexts;
  /** Sprache fürs Datum; fest statt Browsersprache, damit Server und Browser dasselbe anzeigen */
  lang: Lang;
}) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const done = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  const toggle = async (item: OnboardingItem) => {
    if (mode === "customer" && item.owner === "elev8") return;
    const next = !item.done;
    setBusy(item.id);
    setError(false);
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, done: next })
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { items?: OnboardingItem[]; onboarding?: { items: OnboardingItem[] } } | null;
    setBusy(null);
    const fresh = data?.items ?? data?.onboarding?.items;
    if (res?.ok && fresh) setItems(fresh);
    else {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, done: !next } : i)));
      setError(true);
    }
  };

  return (
    <div className="pub-checklist">
      <div className="pub-progress" aria-label={tx.progress.replace("{done}", String(done)).replace("{total}", String(items.length))}>
        <div className="pub-progress-bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <p>
          <strong>{percent} %</strong> · {tx.progress.replace("{done}", String(done)).replace("{total}", String(items.length))}
        </p>
      </div>
      {error && (
        <p className="pub-error" role="alert">
          {tx.saveFailed}
        </p>
      )}
      {PHASES.map((phase, pi) => {
        const list = items.filter((i) => i.phase === phase);
        if (!list.length) return null;
        return (
          <section key={phase} className="pub-phase">
            <h2>
              <span className="pub-phase-num">{String(pi + 1).padStart(2, "0")}</span>
              {tx.phases[phase]}
            </h2>
            <ul>
              {list.map((item) => {
                const locked = mode === "customer" && item.owner === "elev8";
                return (
                  <li key={item.id} className={`pub-item${item.done ? " is-done" : ""}${locked ? " is-locked" : ""}`}>
                    <button
                      type="button"
                      className="pub-tick"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={item.title}
                      disabled={locked || busy === item.id}
                      onClick={() => toggle(item)}
                    >
                      {item.done && <Check size={16} aria-hidden="true" />}
                    </button>
                    <div className="pub-item-main">
                      <p className="pub-item-title">
                        {item.title}
                        <span className={`pub-owner pub-owner-${item.owner}`}>{tx.owner[item.owner]}</span>
                      </p>
                      <p className="pub-item-detail">{item.detail}</p>
                      {item.link && !item.done && (
                        <a className="pub-item-link" href={item.link} target="_blank" rel="noreferrer">
                          {tx.openLink} <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      )}
                      {item.done && item.doneAt && (
                        <p className="pub-item-meta">
                          {tx.doneBy} {formatDate(item.doneAt, lang)}
                          {mode === "team" && item.doneBy ? ` · ${item.doneBy}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
