"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./drafting.css";

export type DraftingData = { enabled: boolean; leadDays: number; lastRunAt: string | null; lastResult: string | null; nextDate: string };

const de = {
  title: "Automatische Entwürfe",
  on: "Ein",
  off: "Aus",
  help: "Wenn eingeschaltet, erstellt das Tool jeden Tag selbst einen Entwurf, im Voraus für einen späteren Tag. Der Beitrag erscheint hier unter „Zur Freigabe“. Veröffentlicht wird erst, wenn du freigibst.",
  switchOn: "Einschalten",
  switchOff: "Ausschalten",
  onText: (days: number, next: string) => `Das Tool erstellt täglich einen Entwurf für den Tag in ${days} Tagen (nächster Tag: ${next}). Freigeben musst du weiterhin selbst.`,
  offText: "Es werden keine Entwürfe von selbst erstellt. Ein Entwurf entsteht nur, wenn jemand ihn anstösst.",
  lead: "Vorlauf",
  daysAhead: (n: number) => `${n} Tage im Voraus`,
  last: "Letzter Lauf",
  never: "noch keiner",
  unavailable: "Der Schalter konnte gerade nicht geladen werden.",
  failed: "Das hat nicht geklappt"
};
const en: typeof de = {
  title: "Automatic drafts",
  on: "On",
  off: "Off",
  help: "When switched on, the tool creates a draft by itself every day, ahead of time for a later day. The post shows up here under \"To approve\". Nothing is published until you approve.",
  switchOn: "Switch on",
  switchOff: "Switch off",
  onText: (days, next) => `The tool creates a draft every day for the day ${days} days ahead (next day: ${next}). You still have to approve.`,
  offText: "No drafts are created by themselves. A draft only appears when someone starts it.",
  lead: "Lead time",
  daysAhead: (n) => `${n} days ahead`,
  last: "Last run",
  never: "none yet",
  unavailable: "The switch could not be loaded right now.",
  failed: "That did not work"
};

const LEADS = [3, 5, 7, 10, 14];

/** Schalter für die automatischen Entwürfe, über der Liste „Zur Freigabe“. */
export function SmDrafting({ locale, data }: { locale: "de" | "en"; data: DraftingData | null }) {
  const s = locale === "en" ? en : de;
  const tp = tipStrings(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) {
    return (
      <section className="drf">
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }
  async function save(body: { enabled?: boolean; leadDays?: number }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sm-manager/drafting", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(`${s.failed}${j.error ? `: ${j.error}` : ""}`);
      } else {
        router.refresh();
      }
    } catch {
      setMsg(s.failed);
    }
    setBusy(false);
  }
  const leads = LEADS.includes(data.leadDays) ? LEADS : [...LEADS, data.leadDays].sort((a, b) => a - b);
  const when = data.lastRunAt ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.lastRunAt)) : s.never;
  return (
    <section className="drf">
      <div className="drf-row">
        <strong>{s.title}</strong>
        <span className={`sm-badge ${data.enabled ? "sm-badge-ok" : ""}`}>{data.enabled ? s.on : s.off}</span>
        <Tip text={s.help} label={tp.label} />
        <button type="button" className={`sm-btn ${data.enabled ? "" : "sm-btn-primary"}`} onClick={() => save({ enabled: !data.enabled })} disabled={busy}>
          {data.enabled ? s.switchOff : s.switchOn}
        </button>
        <label>
          <span className="sm-small sm-muted">{s.lead} </span>
          <select value={data.leadDays} onChange={(e) => save({ leadDays: Number(e.target.value) })} disabled={busy} aria-label={s.lead}>
            {leads.map((n) => (
              <option key={n} value={n}>
                {s.daysAhead(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="sm-muted sm-small">{data.enabled ? s.onText(data.leadDays, data.nextDate) : s.offText}</p>
      <p className="sm-muted sm-small">
        {s.last}: {when}
        {data.lastResult ? ` · ${data.lastResult}` : ""}
      </p>
      {msg ? (
        <p className="sm-warn sm-small" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
