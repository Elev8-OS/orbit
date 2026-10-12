"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useShell } from "./OrbitShell";

/** Puls im Kopf der Übersicht: drei Kennzahlen und bis zu drei offene Punkte aus den Apps. */
type L = { de: string; en: string };
type Metric = { id: string; label: L; value: string; detail?: L; path?: string };
type Action = { id: string; tone: "red" | "amber" | "info"; text: L; path?: string };
type AppPulse = { app: string; name: L; metrics: Metric[]; actions: Action[] };

const TEXT = {
  de: { forYou: "Für dich", open: "öffnen", pulse: "Puls" },
  en: { forYou: "For you", open: "open", pulse: "Pulse" }
};
const TONE_RANK = { red: 0, amber: 1, info: 2 } as const;

export function Pulse({ locale }: { locale: string }) {
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = TEXT[lang];
  const shell = useShell();
  const [data, setData] = useState<AppPulse[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/pulse")
      .then((r) => (r.ok ? r.json() : { apps: [] }))
      .then((d: { apps: AppPulse[] }) => alive && setData(d.apps ?? []))
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
  }, []);

  const open = (app: string, path?: string) => shell?.openApp(app, path);

  if (data === null) {
    return (
      <div className="pulse" aria-hidden="true">
        <div className="pulse-item is-loading" />
        <div className="pulse-item is-loading" />
        <div className="pulse-item is-loading" />
      </div>
    );
  }

  const metrics = data.flatMap((a) => a.metrics.map((m) => ({ ...m, app: a.app, appName: a.name[lang] }))).slice(0, 3);
  const actions = data
    .flatMap((a) => a.actions.map((x) => ({ ...x, app: a.app, appName: a.name[lang] })))
    .sort((a, b) => (TONE_RANK[a.tone] ?? 2) - (TONE_RANK[b.tone] ?? 2))
    .slice(0, 3);
  if (!metrics.length && !actions.length) return null;

  return (
    <>
      {metrics.length > 0 && (
        <ul className="pulse" aria-label={t.pulse}>
          {metrics.map((m) => (
            <li key={`${m.app}-${m.id}`}>
              <button type="button" className="pulse-item" onClick={() => open(m.app, m.path)}>
                <span className="pulse-label">
                  {m.label[lang]}
                  <ArrowUpRight size={14} aria-hidden="true" className="pulse-arrow" />
                </span>
                <span className="pulse-value">{m.value}</span>
                {m.detail && <span className="pulse-detail">{m.detail[lang]}</span>}
                <span className="sr-only">
                  {m.appName} {t.open}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <section className="foryou" aria-label={t.forYou}>
          <h2 className="foryou-title">{t.forYou}</h2>
          <ul>
            {actions.map((a) => (
              <li key={`${a.app}-${a.id}`}>
                <button type="button" className="foryou-item" onClick={() => open(a.app, a.path)}>
                  <span className={`foryou-dot tone-${a.tone}`} aria-hidden="true" />
                  <span className="foryou-text">{a.text[lang]}</span>
                  <span className="foryou-app">{a.appName}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
