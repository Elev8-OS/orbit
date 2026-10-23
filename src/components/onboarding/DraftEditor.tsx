"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { DraftEvent, OnboardingDraft } from "@/lib/onboarding/store";

const when = (iso: string) => new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const EVENT_LABEL: Record<string, string> = {
  created: "Entwurf angelegt",
  edited: "Bearbeitet",
  sent: "Gesendet",
  send_failed: "Senden fehlgeschlagen",
  discarded: "Verworfen"
};

/** Prüfseite: Angaben anpassen, speichern, senden (legt in Orbit 4 das Konto an und schickt die Einladung) oder verwerfen. */
export function DraftEditor({ draft, events, ghlUrl, portalReady }: { draft: OnboardingDraft; events: DraftEvent[]; ghlUrl: string | null; portalReady: boolean }) {
  const router = useRouter();
  const editable = draft.status === "draft";
  const [name, setName] = useState(draft.recipient.name);
  const [email, setEmail] = useState(draft.recipient.email);
  const [company, setCompany] = useState(draft.recipient.company);
  const [phone, setPhone] = useState(draft.recipient.phone);
  const [language, setLanguage] = useState(draft.language);
  const [contractFirst, setContractFirst] = useState(draft.contractFirst);
  const [partnerEmail, setPartnerEmail] = useState(draft.partnerEmail ?? "");
  const [note, setNote] = useState(draft.note ?? "");
  const [busy, setBusy] = useState<null | "save" | "send" | "discard">(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const dirty =
    name !== draft.recipient.name || email !== draft.recipient.email || company !== draft.recipient.company || phone !== draft.recipient.phone ||
    language !== draft.language || contractFirst !== draft.contractFirst || partnerEmail !== (draft.partnerEmail ?? "") || note !== (draft.note ?? "");

  const save = async (): Promise<boolean> => {
    const res = await fetch(`/api/onboarding/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { name, email, company, phone },
        language,
        contractFirst,
        partnerEmail: partnerEmail.trim() || null,
        note: note.trim() || null
      })
    }).catch(() => null);
    if (!res?.ok) {
      setMsg({ text: "Speichern hat nicht geklappt. Bitte Seite neu laden.", ok: false });
      return false;
    }
    return true;
  };

  const onSave = async () => {
    setBusy("save");
    setMsg(null);
    if (await save()) {
      setMsg({ text: "Gespeichert.", ok: true });
      router.refresh();
    }
    setBusy(null);
  };

  const onSend = async () => {
    if (!confirm(`Konto für ${email || "diese Person"} in Orbit 4 anlegen und die Einladung per E-Mail senden?`)) return;
    setBusy("send");
    setMsg(null);
    if (dirty && !(await save())) return setBusy(null);
    const res = await fetch(`/api/onboarding/${draft.id}/send`, { method: "POST" }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; mailed?: boolean }) : {};
    setBusy(null);
    if (!res?.ok || !json.ok) {
      setMsg({ text: json.message ?? "Senden hat nicht geklappt.", ok: false });
      router.refresh();
      return;
    }
    setMsg({ text: json.mailed ? "Gesendet. Das Konto ist angelegt, die Einladung ist per E-Mail raus." : "Das Konto ist angelegt, aber die Einladungs-E-Mail ging nicht raus. Bitte im Partnerportal erneut senden.", ok: Boolean(json.mailed) });
    router.refresh();
  };

  const onDiscard = async () => {
    if (!confirm("Entwurf verwerfen?")) return;
    setBusy("discard");
    const res = await fetch(`/api/onboarding/${draft.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/onboarding");
      return;
    }
    setBusy(null);
    setMsg({ text: "Verwerfen hat nicht geklappt.", ok: false });
  };

  const a = draft.analysis;
  const title = company || name || email || "Onboarding";
  return (
    <div className="ob-detail">
      <div className="ob-head">
        <div>
          <h1>{title}</h1>
          <p className="ob-sub">
            {draft.source === "fireflies" ? `Aus dem Call „${draft.meetingTitle ?? "Call"}“` : "Von Hand angelegt"}
            {draft.status === "sent" && draft.sentAt ? ` · gesendet ${when(draft.sentAt)} von ${draft.sentByName ?? "–"}` : ""}
            {draft.status === "discarded" ? " · verworfen" : ""}
          </p>
        </div>
        {ghlUrl && (
          <a className="ob-btn ob-btn-secondary" href={ghlUrl} target="_blank" rel="noreferrer">
            In GHL öffnen
          </a>
        )}
      </div>

      {draft.status === "sent" && draft.orbitResult && (
        <div className={`ob-msg ${draft.orbitResult.mailed ? "ob-msg-ok" : "ob-msg-warn"}`}>
          Konto in Orbit 4 angelegt.{" "}
          {draft.orbitResult.mailed ? "Einladung per E-Mail gesendet." : "Die Einladungs-E-Mail ging nicht raus. Bitte im Partnerportal erneut senden."}{" "}
          {draft.orbitResult.partner === "assigned" ? "Partner zugeordnet." : "Kein Partner zugeordnet (der GHL-Owner hat in Orbit 4 kein Partner-Konto). Bitte im Partnerportal zuweisen."}
        </div>
      )}
      {draft.error && editable && <p className="ob-msg ob-msg-error">Letzter Versuch: {draft.error}</p>}
      {!portalReady && editable && (
        <p className="ob-msg ob-msg-warn">Die Verbindung zu Orbit 4 ist noch nicht eingerichtet. Senden ist erst möglich, wenn ONBOARDING_SERVICE_SECRET gesetzt ist.</p>
      )}

      <div className="ob-grid ob-grid-detail">
        <section className="ob-card">
          <h2>Empfänger</h2>
          <div className="ob-fields">
            <label className="ob-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} maxLength={120} /></label>
            <label className="ob-field"><span>E-Mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editable} maxLength={200} /></label>
            <label className="ob-field"><span>Firma</span><input value={company} onChange={(e) => setCompany(e.target.value)} disabled={!editable} maxLength={160} /></label>
            <label className="ob-field"><span>Telefon</span><input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editable} maxLength={40} /></label>
            <label className="ob-field">
              <span>Sprache der Einladung</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "de")} disabled={!editable}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="ob-field">
              <span>Zuständiger Partner (E-Mail)</span>
              <input type="email" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} disabled={!editable} maxLength={200} placeholder="leer = kein Partner" />
              <small>{draft.partnerName ? `GHL-Owner: ${draft.partnerName}. ` : ""}Orbit 4 ordnet den Partner über diese E-Mail zu.</small>
            </label>
            <label className="ob-switch ob-wide">
              <input type="checkbox" checked={contractFirst} onChange={(e) => setContractFirst(e.target.checked)} disabled={!editable} />
              Kunde möchte den Vertrag vor dem ersten Call
            </label>
            <label className="ob-field ob-wide">
              <span>Interne Notiz</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} maxLength={2000} />
            </label>
          </div>
          {contractFirst && editable && <p className="ob-hint">Der Wunsch wird beim Kunden in Orbit 4 vorgemerkt. Den Vertrag stellst du heute noch von Hand zu.</p>}
          {editable && (
            <div className="ob-actions">
              <button type="button" className="ob-btn ob-btn-link" onClick={onDiscard} disabled={busy !== null}>Verwerfen</button>
              <span className="ob-spacer" />
              <button type="button" className="ob-btn ob-btn-secondary" onClick={onSave} disabled={busy !== null || !dirty}>Speichern</button>
              <button type="button" className="ob-btn ob-btn-primary" onClick={onSend} disabled={busy !== null || !portalReady}>
                <Send size={16} aria-hidden="true" />
                {busy === "send" ? "Wird gesendet …" : "Senden"}
              </button>
            </div>
          )}
          {msg && <p className={`ob-msg ${msg.ok ? "ob-msg-ok" : "ob-msg-error"}`} role="status">{msg.text}</p>}
        </section>

        <div className="ob-side">
          {a && (
            <section className="ob-card">
              <h2>Aus dem Gespräch</h2>
              <blockquote className="ob-quote">{a.evidence}</blockquote>
              <p className="ob-muted">{a.summary}</p>
              <dl className="ob-facts">
                <dt>Erkannt mit Sicherheit</dt>
                <dd>{a.confidence === "high" ? "hoch" : "mittel"}</dd>
                {a.startDate && (<><dt>Gewünschter Start</dt><dd>{a.startDate}</dd></>)}
              </dl>
            </section>
          )}
          <section className="ob-card">
            <h2>Was beim Senden passiert</h2>
            <ol className="ob-steps">
              <li>Orbit legt in Orbit 4 das Kundenkonto an.</li>
              <li>Der GHL-Kontakt wird verknüpft oder neu erstellt, Tags und Zuständiger werden gesetzt.</li>
              <li>Der Kunde erhält eine E-Mail mit persönlichem Link (7 Tage gültig).</li>
              <li>Im GHL-Kontakt steht eine Notiz.</li>
            </ol>
          </section>
          <section className="ob-card">
            <h2>Verlauf</h2>
            <ul className="ob-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="ob-strong">{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="ob-muted">{when(e.at)} · {e.actor ?? "System"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
