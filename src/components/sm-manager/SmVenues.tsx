"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Photo, VenueSummary } from "@/lib/venues/store";
import "./venues.css";

export type VenueItem = VenueSummary & { link: string };
export type VenuesData = { venues: VenueItem[]; storage: boolean };

type Locale = "de" | "en";

export function venueTabLabel(locale: Locale): string {
  return locale === "en" ? "Places" : "Orte";
}

const usable = (v: VenueItem) => Boolean(v.consentAt) && v.approved > 0;

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch {
    return { ok: false };
  }
}

/** Der Text der Nachricht; derselbe, der später als WhatsApp-Template laufen soll. Ohne Ansprechperson wird der Betrieb angesprochen. */
function messageFor(contactName: string, spotName: string, link: string): string {
  const hello = contactName.trim() || `${spotName} team`;
  return `Hi ${hello}, this is Reto from The R Villas in Pererenan. 🌴 Thank you for agreeing to be featured. We would love to show ${spotName} to our guests on Instagram. Please upload a few photos here and add a short note for each: ${link} It takes about two minutes. Thank you!`;
}

/** WhatsApp Web mit fertigem Text; leer, wenn die Nummer nicht reicht. */
function whatsappUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}` : "";
}

export function SmVenues({ locale, data }: { locale: Locale; data: VenuesData | null }) {
  const router = useRouter();
  const l = (de: string, en: string) => (locale === "de" ? de : en);
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "review" | "waiting" | "ready">("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!data) return <p className="sm-empty">{l("Die Orte konnten nicht geladen werden.", "The places could not be loaded.")}</p>;

  const venues = data.venues;
  const counts = {
    ready: venues.filter(usable).length,
    review: venues.filter((v) => v.pending > 0).length,
    waiting: venues.filter((v) => v.photos === 0).length
  };
  const shown = venues.filter((v) => (filter === "all" ? true : filter === "review" ? v.pending > 0 : filter === "waiting" ? v.photos === 0 : usable(v)));

  async function seed() {
    setBusy(true);
    setMsg("");
    const r = await call("POST", "/api/sm-manager/venues", { seed: true });
    setBusy(false);
    if (r.ok) {
      setMsg(l("Angaben aus dem Guide ergänzt. Bereits Eingetragenes bleibt unverändert.", "Details from the guide added. Anything already entered stays as it is."));
      router.refresh();
    } else setMsg(l("Anlegen fehlgeschlagen", "Could not create the places"));
  }

  return (
    <section className="ve">
      <p className="sm-muted">
        {l(
          "Betriebe aus dem Umgebungs-Guide, mit Nummer, Instagram und Website vorbelegt, soweit gefunden. Jeder hat einen persönlichen Link, über den er Fotos hochlädt und seine Daten selbst einträgt. Ein Klick auf die Nummer öffnet WhatsApp Web mit dem fertigen Text samt Link. Für Beiträge zählt ein Ort nur, wenn die Einwilligung bestätigt ist und mindestens ein Foto freigegeben wurde.",
          "Venues from the area guide, prefilled with number, Instagram and website where found. Each has a personal link to upload photos and enter their own details. Click the number to open WhatsApp Web with the finished text and link. A place is only used in posts when consent is confirmed and at least one photo is approved."
        )}
      </p>

      {!data.storage ? (
        <p className="sm-warn">{l("Der Foto-Speicher ist nicht verbunden. Uploads funktionieren erst, wenn die S3-Variablen gesetzt sind und Orbit neu gestartet wurde.", "Photo storage is not connected. Uploads work once the S3 variables are set and Orbit has been redeployed.")}</p>
      ) : null}

      {venues.length === 0 ? (
        <div className="ve-empty">
          <p>{l("Noch keine Orte angelegt.", "No places yet.")}</p>
          <button type="button" className="sm-btn sm-btn-primary" onClick={seed} disabled={busy}>
            {l("30 Orte aus dem Umgebungs-Guide anlegen", "Create the 30 places from the area guide")}
          </button>
          {msg ? <p className="sm-warn">{msg}</p> : null}
        </div>
      ) : (
        <>
          <div className="ve-filters" role="group">
            <button type="button" className={`sm-btn ${filter === "all" ? "sm-btn-primary" : ""}`} onClick={() => setFilter("all")}>
              {l("Alle", "All")} ({venues.length})
            </button>
            <button type="button" className={`sm-btn ${filter === "review" ? "sm-btn-primary" : ""}`} onClick={() => setFilter("review")}>
              {l("Fotos prüfen", "Photos to review")} ({counts.review})
            </button>
            <button type="button" className={`sm-btn ${filter === "waiting" ? "sm-btn-primary" : ""}`} onClick={() => setFilter("waiting")}>
              {l("Warten auf Fotos", "Waiting for photos")} ({counts.waiting})
            </button>
            <button type="button" className={`sm-btn ${filter === "ready" ? "sm-btn-primary" : ""}`} onClick={() => setFilter("ready")}>
              {l("Für Beiträge bereit", "Ready for posts")} ({counts.ready})
            </button>
            <button type="button" className="sm-btn" onClick={seed} disabled={busy} title={l("Füllt fehlende Angaben nach, überschreibt nichts", "Fills in missing details, overwrites nothing")}>
              {l("Angaben aus dem Guide ergänzen", "Add details from the guide")}
            </button>
          </div>
          {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
          <ul className="ve-list">
            {shown.map((v) => (
              <VenueRow key={v.id} v={v} locale={locale} isOpen={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} onChanged={() => router.refresh()} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const STATUS_DE: Record<string, string> = { new: "Neu", sent: "Versendet", opened: "Link geöffnet", uploaded: "Fotos da" };
const STATUS_EN: Record<string, string> = { new: "New", sent: "Sent", opened: "Link opened", uploaded: "Photos in" };

function VenueRow({ v, locale, isOpen, onToggle, onChanged }: { v: VenueItem; locale: Locale; isOpen: boolean; onToggle: () => void; onChanged: () => void }) {
  const l = (de: string, en: string) => (locale === "de" ? de : en);
  const [form, setForm] = useState({ contact_name: v.contactName, phone: v.phone, email: v.email, instagram: v.instagram, consent_ref: v.consentRef });
  const [consent, setConsent] = useState(Boolean(v.consentAt));
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadPhotos() {
    try {
      const res = await fetch(`/api/sm-manager/venues/${v.id}`);
      if (res.ok) setPhotos(((await res.json()) as { photos: Photo[] }).photos);
    } catch {
      /* bleibt leer */
    }
  }
  useEffect(() => {
    if (isOpen && photos === null) void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setBusy(true);
    setMsg("");
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? okText : `${l("Fehlgeschlagen", "Failed")}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) onChanged();
    return r.ok;
  }

  const save = () =>
    run(() => call("PUT", `/api/sm-manager/venues/${v.id}`, { ...form, ...(consent && !v.consentAt ? { consent_confirmed: true } : {}) }), l("Gespeichert", "Saved"));
  const rotate = async () => {
    if (!confirm(l("Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.", "Create a new link? The old link will stop working."))) return;
    await run(() => call("PUT", `/api/sm-manager/venues/${v.id}`, { rotate: true }), l("Neuer Link erzeugt", "New link created"));
  };
  const toggleLink = () => run(() => call("PUT", `/api/sm-manager/venues/${v.id}`, { token_active: !v.tokenActive }), v.tokenActive ? l("Link gesperrt", "Link blocked") : l("Link freigegeben", "Link enabled"));
  const review = async (id: number, state: "approved" | "rejected" | "pending") => {
    if (await run(() => call("PUT", `/api/sm-manager/venues/photos/${id}`, { review: state }), l("Gespeichert", "Saved"))) await loadPhotos();
  };
  const remove = async (id: number) => {
    if (!confirm(l("Dieses Foto endgültig löschen?", "Delete this photo for good?"))) return;
    if (await run(() => call("DELETE", `/api/sm-manager/venues/photos/${id}`), l("Gelöscht", "Deleted"))) await loadPhotos();
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(l("Kopiert", "Copied"));
    } catch {
      setMsg(l("Kopieren nicht möglich", "Could not copy"));
    }
  };
  // Der Klick öffnet WhatsApp Web; ob die Nachricht dort wirklich abgeschickt wird, weiß Orbit nicht.
  const markSent = () => {
    void call("PUT", `/api/sm-manager/venues/${v.id}`, { mark_sent: "whatsapp" }).then((r) => {
      if (r.ok) onChanged();
    });
  };

  const rowUrl = whatsappUrl(v.phone, messageFor(v.contactName, v.spotName, v.link));
  const panelText = messageFor(form.contact_name, v.spotName, v.link);
  const panelUrl = whatsappUrl(form.phone, panelText);
  const status = (locale === "de" ? STATUS_DE : STATUS_EN)[v.status] ?? v.status;
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "short" }).format(new Date(iso)) : "–");
  const phoneNote =
    v.phoneSource === "google"
      ? l("Nummer aus Google Maps, bitte vor dem ersten Versand prüfen.", "Number from Google Maps, please check it before the first message.")
      : v.phoneSource === "public"
        ? l("Nummer aus öffentlichen Quellen (Website oder Verzeichnis).", "Number from public sources (website or directory).")
        : v.phoneSource === "entered"
          ? l("Nummer vom Betrieb oder von Hand eingetragen.", "Number entered by the venue or by hand.")
          : "";

  return (
    <li className={`ve-item ${isOpen ? "ve-open" : ""}`}>
      <div className="ve-head">
        <button type="button" className="ve-toggle" onClick={onToggle} aria-expanded={isOpen}>
          <strong>{v.spotName}</strong>
          <span className="sm-badge">{status}</span>
          {!v.tokenActive ? <span className="sm-badge">{l("Link gesperrt", "Link blocked")}</span> : null}
          <span className="sm-muted sm-small">
            {v.photos === 0 ? l("keine Fotos", "no photos") : `${v.approved} ${l("freigegeben", "approved")} · ${v.pending} ${l("offen", "to review")}`}
          </span>
          <span className={`sm-badge ${usable(v) ? "sm-badge-ok" : ""}`}>{usable(v) ? l("bereit", "ready") : v.consentAt ? l("Einwilligung ✓", "Consent ✓") : l("Einwilligung offen", "Consent open")}</span>
        </button>
        {rowUrl && v.tokenActive ? (
          <a className="sm-btn ve-wa" href={rowUrl} target="_blank" rel="noreferrer" onClick={markSent} title={l("Öffnet WhatsApp Web mit dem fertigen Text und Link", "Opens WhatsApp Web with the finished text and link")}>
            {v.phone} · WhatsApp
          </a>
        ) : (
          <span className="sm-muted sm-small">{v.tokenActive ? l("Nummer fehlt (im Detail eintragen)", "No number (add it in the details)") : l("Link gesperrt", "Link blocked")}</span>
        )}
      </div>

      {isOpen ? (
        <div className="ve-panel">
          <div className="ve-grid">
            <label>
              {l("Ansprechperson", "Contact person")}
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} maxLength={80} placeholder={`${v.spotName} team`} />
            </label>
            <label>
              {l("Telefon / WhatsApp (mit Landesvorwahl)", "Phone / WhatsApp (with country code)")}
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+62 …" inputMode="tel" />
            </label>
            <label>
              E-Mail
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" />
            </label>
            <label>
              Instagram
              <input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@name" />
            </label>
            <label className="ve-wide">
              {l("Nachweis der Einwilligung (der Betrieb setzt sie beim Upload selbst, hier optional)", "Proof of consent (the venue sets it on upload, optional here)")}
              <input value={form.consent_ref} onChange={(e) => setForm({ ...form, consent_ref: e.target.value })} maxLength={200} />
            </label>
          </div>
          <p className="sm-muted sm-small">
            {phoneNote}
            {v.website ? (
              <>
                {phoneNote ? " · " : ""}
                <a href={v.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              </>
            ) : null}
            {v.placeId ? (
              <>
                {phoneNote || v.website ? " · " : ""}
                <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(v.placeId)}`} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
              </>
            ) : null}
          </p>
          <label className="ve-check">
            <input type="checkbox" checked={consent} disabled={Boolean(v.consentAt)} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {v.consentAt
                ? `${l("Einwilligung bestätigt am", "Consent confirmed on")} ${fmt(v.consentAt)}`
                : l("Einwilligung von Hand bestätigen (sonst setzt sie der Betrieb beim ersten Upload)", "Confirm consent by hand (otherwise the venue sets it on the first upload)")}
            </span>
          </label>
          <div className="ve-actions">
            <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy}>
              {l("Speichern", "Save")}
            </button>
          </div>

          <h4>{l("Persönlicher Link", "Personal link")}</h4>
          <div className="ve-link">
            <code>{v.link}</code>
          </div>
          <div className="ve-actions">
            <button type="button" className="sm-btn" onClick={() => copy(v.link)}>
              {l("Link kopieren", "Copy link")}
            </button>
            <button type="button" className="sm-btn" onClick={() => copy(panelText)}>
              {l("Nachricht kopieren", "Copy message")}
            </button>
            {panelUrl && v.tokenActive ? (
              <a className="sm-btn" href={panelUrl} target="_blank" rel="noreferrer" onClick={markSent}>
                {l("In WhatsApp Web öffnen", "Open in WhatsApp Web")}
              </a>
            ) : null}
            <button type="button" className="sm-btn" onClick={toggleLink} disabled={busy}>
              {v.tokenActive ? l("Link sperren", "Block link") : l("Link freigeben", "Enable link")}
            </button>
            <button type="button" className="sm-btn" onClick={rotate} disabled={busy}>
              {l("Neuen Link erzeugen", "New link")}
            </button>
          </div>
          <p className="sm-muted sm-small">
            {l("Link geöffnet:", "Link opened:")} {fmt(v.openedAt)} · {l("Versendet:", "Sent:")} {fmt(v.sentAt)}
          </p>

          <h4>{l("Fotos", "Photos")}</h4>
          {photos === null ? (
            <p className="sm-muted sm-small">{l("Lädt …", "Loading …")}</p>
          ) : photos.length === 0 ? (
            <p className="sm-muted sm-small">{l("Noch keine Fotos hochgeladen.", "No photos uploaded yet.")}</p>
          ) : (
            <ul className="ve-photos">
              {photos.map((p) => (
                <li key={p.id} className={`ve-photo ve-${p.review}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/sm-manager/venues/photos/${p.id}`} alt={p.caption || p.filename} loading="lazy" />
                  <p className="sm-small">{p.caption || <span className="sm-muted">{l("ohne Beschreibung", "no description")}</span>}</p>
                  <div className="ve-actions">
                    <button type="button" className={`sm-btn ${p.review === "approved" ? "sm-btn-primary" : ""}`} onClick={() => review(p.id, p.review === "approved" ? "pending" : "approved")} disabled={busy}>
                      {p.review === "approved" ? l("Freigegeben ✓", "Approved ✓") : l("Freigeben", "Approve")}
                    </button>
                    <button type="button" className="sm-btn" onClick={() => review(p.id, p.review === "rejected" ? "pending" : "rejected")} disabled={busy}>
                      {p.review === "rejected" ? l("Abgelehnt", "Rejected") : l("Ablehnen", "Reject")}
                    </button>
                    <button type="button" className="sm-btn" onClick={() => remove(p.id)} disabled={busy}>
                      {l("Löschen", "Delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
