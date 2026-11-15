"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, RefreshCw, Search } from "lucide-react";
import { revealCodesAction, switchTenantAction } from "@/app/gro/actions";

export function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="gr-btn gr-btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* Zwischenablage nicht erlaubt */
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? "Kopiert" : label}
    </button>
  );
}

/** Lädt die Seite in festen Abständen neu, damit die Live-Daten aus Elev8 frisch bleiben (nur bei sichtbarem Tab) */
export function AutoRefresh({ seconds = 60, at }: { seconds?: number; at: number | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const reload = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(reload);
    };
  }, [router, seconds]);
  const age = at && now ? Math.max(0, Math.round((now - at) / 1000)) : null;
  return (
    <span className="gr-live">
      <span className="gr-dot" aria-hidden="true" />
      {age === null ? "Live aus Elev8" : `Live aus Elev8, Stand vor ${age < 90 ? `${age} Sek.` : `${Math.round(age / 60)} Min.`}`}
      <button type="button" className="gr-btn gr-btn-link" disabled={busy} onClick={() => start(() => router.refresh())} aria-label="Jetzt aktualisieren">
        <RefreshCw size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

export function TenantSwitch({ tenants, current }: { tenants: { slug: string; name: string }[]; current: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  if (tenants.length < 2) return <div className="gr-tenant-one">{tenants[0]?.name}</div>;
  return (
    <label className="gr-tenant">
      <span>Mandant</span>
      <select
        value={current}
        disabled={busy}
        onChange={(e) =>
          start(async () => {
            await switchTenantAction(e.target.value);
            router.refresh();
          })
        }
      >
        {tenants.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Schnellwahl: Gastsatz tippen, Prozess öffnen */
export function QuickSearch({ items }: { items: { phrase: string; key: string; title: string }[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => (i.phrase + " " + i.title + " " + i.key).toLowerCase().includes(s)).slice(0, 8);
  }, [q, items]);
  return (
    <div className="gr-quick">
      <label className="gr-quick-input">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Was sagt der Gast? Zum Beispiel Türcode, länger bleiben, zu dritt" aria-label="Schnellwahl" />
      </label>
      <ul className="gr-quick-list">
        {hits.map((h) => (
          <li key={h.phrase}>
            <a href={`/gro/prozesse/${h.key}`}>
              <span>{h.phrase}</span>
              <b>{h.key}</b>
            </a>
          </li>
        ))}
        {!hits.length && <li className="gr-muted">Nichts gefunden. Unter Prozesse alle Karten durchsuchen.</li>}
      </ul>
    </div>
  );
}

/** Vorlage mit Platzhaltern ausfüllen und kopieren */
export function TemplateFill({ body }: { body: string }) {
  const [vorname, setVorname] = useState("");
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const text = body.replace(/\{\{vorname\}\}/g, vorname || "{{vorname}}").replace(/\{\{link\}\}/g, link || "{{link}}").replace(/\{\{name\}\}/g, name || "{{name}}");
  return (
    <div className="gr-fill">
      <div className="gr-fill-fields">
        <label>
          <span>Vorname</span>
          <input value={vorname} onChange={(e) => setVorname(e.target.value)} />
        </label>
        <label>
          <span>Gästeführer-Link dieser Buchung</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" />
        </label>
        <label>
          <span>Dein Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <pre className="gr-pre">{text}</pre>
      <CopyButton text={text} label="Nachricht kopieren" />
    </div>
  );
}

/** Rechner für die Zusatzperson (P-4.1), Werte kommen aus den Regeln des Mandanten */
export function ZusatzRechner({ gebuehr, citytax, karte, grund }: { gebuehr: number; citytax: number; karte: number; grund: number }) {
  const [personen, setPersonen] = useState(1);
  const [naechte, setNaechte] = useState(3);
  const [gebuchte, setGebuchte] = useState(grund);
  const [mitKarte, setMitKarte] = useState(true);
  const frei = Math.max(0, grund - gebuchte);
  const bezahlt = Math.max(0, personen - frei);
  const summe = (bezahlt * gebuehr + personen * citytax) * naechte;
  const total = mitKarte ? summe * (1 + karte / 100) : summe;
  const chf = (n: number) => `CHF ${(Math.round(n * 100) / 100).toFixed(2)}`;
  return (
    <div className="gr-calc">
      <h3>Rechner Zusatzperson</h3>
      <div className="gr-fill-fields">
        <label>
          <span>Zusatzpersonen</span>
          <input type="number" min={1} value={personen} onChange={(e) => setPersonen(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label>
          <span>Nächte</span>
          <input type="number" min={1} value={naechte} onChange={(e) => setNaechte(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label>
          <span>Gebucht für (Personen)</span>
          <input type="number" min={1} value={gebuchte} onChange={(e) => setGebuchte(Math.max(1, Number(e.target.value) || 1))} />
        </label>
      </div>
      <label className="gr-check">
        <input type="checkbox" checked={mitKarte} onChange={(e) => setMitKarte(e.target.checked)} /> Gebührenmodus Karte (+{karte} %)
      </label>
      <p className="gr-calc-sum">
        <b>{chf(summe)}</b> ohne Kartengebühr{mitKarte && <> · Gast zahlt <b>{chf(total)}</b></>}
      </p>
      {frei > 0 && <p className="gr-muted">{frei} Person(en) liegen im Grundpreis, dafür nur Citytax.</p>}
      <p className="gr-muted">Betrag im Payment Request ohne Gebühr eingeben, den Gebührenmodus dort wählen.</p>
    </div>
  );
}

export function RevealCodes({ listingId }: { listingId: string }) {
  const [codes, setCodes] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (codes !== undefined)
    return (
      <span className="gr-codes">
        <code>{codes ?? "kein Code hinterlegt"}</code>
        <button type="button" className="gr-btn gr-btn-link" onClick={() => setCodes(undefined)}>
          ausblenden
        </button>
      </span>
    );
  return (
    <span className="gr-inline">
      <button
        type="button"
        className="gr-btn gr-btn-secondary"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await revealCodesAction(listingId);
            if (r.error) setError(r.error);
            else setCodes(r.codes);
          })
        }
      >
        <Eye size={14} aria-hidden="true" /> Code anzeigen
      </button>
      {error && <span className="gr-msg gr-msg-error">{error}</span>}
    </span>
  );
}
