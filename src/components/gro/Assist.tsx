"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { assistAction } from "@/app/gro/actions";
import type { AssistResult } from "@/lib/gro/assist";

/** Nachschlagen: Gästetext, Anrufnotiz oder Stichwort einfügen, passende Prozesse mit Schritten erscheinen direkt. */
export function Assist() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<AssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = () => {
    if (!text.trim()) return;
    setError(null);
    start(async () => {
      try {
        setRes(await assistAction(text));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler");
      }
    });
  };
  return (
    <section className="gr-card gr-assist">
      <label className="gr-field">
        <span>Nachschlagen: Gästenachricht, Anrufnotiz oder Stichwort einfügen</span>
        <textarea
          rows={3}
          value={text}
          maxLength={3000}
          placeholder="Zum Beispiel: Hallo, der Code geht nicht und wir sind jetzt zu dritt."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
          }}
        />
      </label>
      <div className="gr-form-foot">
        <button type="button" className="gr-btn gr-btn-primary" disabled={busy || !text.trim()} onClick={run}>
          <Sparkles size={14} aria-hidden="true" /> {busy ? "Sucht…" : "Nachschlagen"}
        </button>
        {res && (
          <button type="button" className="gr-btn gr-btn-link" onClick={() => { setRes(null); setText(""); }}>
            Leeren
          </button>
        )}
        <span className="gr-muted">Der Text wird nicht gespeichert. Namen und Codes besser weglassen.</span>
      </div>
      {error && <p className="gr-msg gr-msg-error">{error}</p>}
      {res && (
        <div className="gr-assist-res" aria-live="polite">
          {res.summary && <p><b>Anliegen:</b> {res.summary}</p>}
          {res.note && <p className="gr-muted">{res.note}</p>}
          {res.hits.map((h, i) => (
            <details key={h.key} className="gr-assist-hit" open={i === 0}>
              <summary>
                <span className="gr-key">{h.key}</span> <span className="gr-strong">{h.title}</span>
                {h.status !== "freigegeben" && <span className="gr-pill gr-pill-warn">Entwurf</span>}
              </summary>
              {h.why && <p className="gr-muted">{h.why}</p>}
              <ol className="gr-steps">{h.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
              {h.rules.length > 0 && <ul className="gr-bullets">{h.rules.map((s, j) => <li key={j}>{s}</li>)}</ul>}
              {h.escalation && <p><b>Eskalation:</b> {h.escalation}</p>}
              {h.open.length > 0 && <p className="gr-muted">Offen: {h.open.join(" · ")}</p>}
              <a className="gr-btn gr-btn-secondary" href={`/gro/prozesse/${h.key}`}>Ganze Karte{h.key === "P-4.1" ? " mit Rechner" : ""}</a>
            </details>
          ))}
          {res.templates.length > 0 && (
            <p>
              Passende Vorlage: {res.templates.map((t) => <a key={t.key} className="gr-pill" href="/gro/vorlagen">{t.key} {t.title}</a>)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
