'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Photo, VenueSummary } from '@/lib/venues/store';
import './venues.css';
import './ghl.css';

export type VenueItem = VenueSummary & { link: string };
export type VenueBrand = { name: string; instagram: string; sender: string; hasLogo: boolean };
export type VenuesData = { venues: VenueItem[]; storage: boolean; brand: VenueBrand };

type Locale = 'de' | 'en';
type GhlInfo = { contactId: string; optInAt: string | null; syncedAt: string | null; note: string; waStatus: string; waStatusAt: string | null; waError: string; waReplied: boolean };
type GhlData = { status: { configured: boolean; location?: string | null; fields?: { venue_token?: boolean; venue_link?: boolean }; error?: string | null }; infos: Record<string, GhlInfo> };
type SyncSummary = { synced: number; skipped: number; failed: number; items: { id: number; name: string; ok: boolean; reason: string }[] };

export function venueTabLabel(locale: Locale): string {
  return locale === 'en' ? 'Places' : 'Orte';
}

const usable = (v: VenueItem) => Boolean(v.consentAt) && v.approved > 0;
/** Die Business-WhatsApp-Nachricht kam nicht an (oder GHL hat gar keine gefunden). */
const notDelivered = (i?: GhlInfo) => i?.waStatus === 'failed' || i?.waStatus === 'none';
/** Der Guide rät nur mit Einschränkung zu diesem Betrieb. */
const cautious = (v: VenueItem) => /^nur mit hinweis/i.test(v.fit);

async function call<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string; json?: T }> {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, json } : { ok: false, error: json.error };
  } catch {
    return { ok: false };
  }
}

/**
 * Die Nachricht an den Betrieb. Sie kommt vom Betreiber (Tenant), nicht von der Software.
 * Aufbau: Gruss, wer und wo, Nutzen für den Betrieb, genau eine Bitte mit Zeitrahmen, Link allein auf einer Zeile,
 * Gegen-Tag, Dank. Kurze Absätze, *fett* nur für das Wichtige, wie WhatsApp es darstellt.
 * Ohne Ansprechperson wird der Betrieb angesprochen. Dieselbe Fassung steht im WhatsApp-Template (Business).
 * "reminder" ist die kurze Erinnerung nach ein bis zwei Tagen.
 */
function messageFor(brand: VenueBrand, contactName: string, spotName: string, link: string, kind: 'first' | 'reminder' = 'first'): string {
  const hello = contactName.trim() || `${spotName} team`;
  if (kind === 'reminder') {
    return `Hi ${hello} 👋\n\nQuick reminder from ${brand.sender} at *${brand.name}*: your feature is waiting for your photos. 📸\n\n3 photos are enough, it takes 2 minutes:\n${link}\n\nHappy to help with anything here. Thank you! 🙏`;
  }
  const where = brand.instagram ? ` (@${brand.instagram})` : '';
  return `Hi ${hello} 👋\n\nIt's ${brand.sender} from *${brand.name}*, just around the corner in Pererenan.\n\nWe send our guests to *${spotName}* and we would love to feature you on our Instagram${where} as one of our local tips. *Free, and tagged to you.* 🌴\n\nAll we need:\n📸 3 to 5 of your best photos\n✍️ one line about each\n\nTakes 2 minutes 👇\n${link}\n\nIf you tag us back, even better. We keep sending guests your way. Together we are stronger 🤝\n\nThank you!\n${brand.sender}`;
}

/** WhatsApp Web mit fertigem Text; leer, wenn die Nummer nicht reicht. */
function whatsappUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}` : '';
}

export function SmVenues({ locale, data }: { locale: Locale; data: VenuesData | null }) {
  const router = useRouter();
  const l = (de: string, en: string) => (locale === 'de' ? de : en);
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'review' | 'waiting' | 'ready' | 'failed'>('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ghl, setGhl] = useState<GhlData | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  async function loadGhl() {
    try {
      const res = await fetch('/api/sm-manager/venues/ghl');
      if (res.ok) setGhl((await res.json()) as GhlData);
    } catch {
      /* bleibt leer */
    }
  }
  // Beim Öffnen: Stand laden, dann bei GHL nachfragen, ob verschickte Nachrichten angekommen sind, und neu laden.
  useEffect(() => {
    void (async () => {
      await loadGhl();
      const r = await call<{ checked: number }>('POST', '/api/sm-manager/venues/ghl', { action: 'delivery' });
      if (r.ok && (r.json?.checked ?? 0) > 0) await loadGhl();
    })();
  }, []);

  if (!data) return <p className="sm-empty">{l('Die Orte konnten nicht geladen werden.', 'The places could not be loaded.')}</p>;

  const venues = data.venues;
  const brand = data.brand;
  const failedCount = venues.filter((v) => notDelivered(ghl?.infos[String(v.id)])).length;
  const counts = {
    ready: venues.filter(usable).length,
    review: venues.filter((v) => v.pending > 0).length,
    waiting: venues.filter((v) => v.photos === 0).length
  };
  const shown = venues.filter((v) =>
    filter === 'all' ? true : filter === 'review' ? v.pending > 0 : filter === 'waiting' ? v.photos === 0 : filter === 'failed' ? notDelivered(ghl?.infos[String(v.id)]) : usable(v)
  );
  const missing = [!brand.instagram ? 'TENANT_INSTAGRAM' : '', !brand.hasLogo ? 'TENANT_LOGO_URL' : ''].filter(Boolean);
  const inGhl = ghl ? Object.values(ghl.infos).filter((i) => i.contactId).length : 0;
  const fieldsMissing = ghl?.status.configured && ghl.status.fields && (!ghl.status.fields.venue_token || !ghl.status.fields.venue_link);
  const businessSent = venues.filter((v) => v.lastChannel === 'whatsapp_business' && v.sentAt);

  async function seed() {
    setBusy(true);
    setMsg('');
    const r = await call<{ created: number; updated: number }>('POST', '/api/sm-manager/venues', { seed: true });
    setBusy(false);
    if (r.ok) {
      setMsg(l(`Liste aus dem Guide abgeglichen: ${r.json?.created ?? 0} neu, ${r.json?.updated ?? 0} ergänzt. Bereits Eingetragenes bleibt unverändert.`, `Guide list synced: ${r.json?.created ?? 0} new, ${r.json?.updated ?? 0} updated. Anything already entered stays as it is.`));
      router.refresh();
    } else setMsg(l('Anlegen fehlgeschlagen', 'Could not create the places'));
  }

  async function syncAll() {
    setBusy(true);
    setMsg(l('Die Orte werden in GHL angelegt … das dauert einen Moment.', 'Creating the places in GHL ... this takes a moment.'));
    setSummary(null);
    const r = await call<SyncSummary>('POST', '/api/sm-manager/venues/ghl', { action: 'sync' });
    setBusy(false);
    if (!r.ok || !r.json) {
      setMsg(`${l('Fehlgeschlagen', 'Failed')}${r.error ? `: ${r.error}` : ''}`);
      return;
    }
    setSummary(r.json);
    setMsg('');
    await loadGhl();
    router.refresh();
  }

  async function checkAll() {
    setBusy(true);
    setMsg(l('Zustellung wird bei GHL abgefragt …', 'Asking GHL about delivery ...'));
    const r = await call<{ checked: number }>('POST', '/api/sm-manager/venues/ghl', { action: 'delivery', ids: businessSent.map((v) => v.id) });
    setBusy(false);
    setMsg(r.ok ? l(`${r.json?.checked ?? 0} Nachrichten geprüft.`, `${r.json?.checked ?? 0} messages checked.`) : `${l('Fehlgeschlagen', 'Failed')}${r.error ? `: ${r.error}` : ''}`);
    await loadGhl();
  }

  return (
    <section className="ve">
      <p className="sm-muted">
        {l(
          'Betriebe aus dem Umgebungs-Guide, mit Nummer, Instagram und Website vorbelegt, soweit gefunden. Jeder hat einen persönlichen Link, über den er Fotos hochlädt und seine Daten selbst einträgt. Der erste Kontakt läuft persönlich: ein Klick auf die Nummer öffnet WhatsApp Web mit dem fertigen Text. Hat ein Betrieb zugestimmt, per WhatsApp Business zu schreiben, schickt ein Knopf die Vorlage über GHL. Kommen nach zwei Tagen keine Fotos, geht die Erinnerung automatisch raus. Kommt eine Nachricht nicht an, wird der Betrieb rot markiert. Für Beiträge zählt ein Ort nur, wenn die Einwilligung bestätigt ist und mindestens ein Foto freigegeben wurde.',
          'Venues from the area guide, prefilled with number, Instagram and website where found. Each has a personal link to upload photos and enter their own details. The first contact is personal: clicking the number opens WhatsApp Web with the finished text. Once a venue has agreed to WhatsApp Business messages, a button sends the template through GHL. If no photos arrive after two days, the reminder goes out automatically. If a message does not arrive, the venue is marked red. A place is only used in posts when consent is confirmed and at least one photo is approved.'
        )}
      </p>

      {missing.length > 0 ? (
        <p className="sm-warn">
          {l(
            `Angaben des Betreibers fehlen (${missing.join(', ')}). Ohne den Instagram-Namen nennt die Nachricht kein Konto zum Taggen, ohne Logo zeigt die Upload-Seite nur den Namen. Beides wird als Umgebungsvariable am Orbit-Dienst gesetzt, der Instagram-Name sonst aus Elev8 gelesen.`,
            `Operator details are missing (${missing.join(', ')}). Without the Instagram name the message names no account to tag, without a logo the upload page shows the name only. Both are set as environment variables on the Orbit service, the Instagram name is otherwise read from Elev8.`
          )}
        </p>
      ) : null}

      {!data.storage ? (
        <p className="sm-warn">{l('Der Foto-Speicher ist nicht verbunden. Uploads funktionieren erst, wenn die S3-Variablen gesetzt sind und Orbit neu gestartet wurde.', 'Photo storage is not connected. Uploads work once the S3 variables are set and Orbit has been redeployed.')}</p>
      ) : null}

      {venues.length === 0 ? (
        <div className="ve-empty">
          <p>{l('Noch keine Orte angelegt.', 'No places yet.')}</p>
          <button type="button" className="sm-btn sm-btn-primary" onClick={seed} disabled={busy}>
            {l('Orte aus dem Umgebungs-Guide anlegen', 'Create the places from the area guide')}
          </button>
          {msg ? <p className="sm-warn">{msg}</p> : null}
        </div>
      ) : (
        <>
          <div className="ve-ghl">
            <strong>{l('GHL und WhatsApp Business', 'GHL and WhatsApp Business')}</strong>
            {ghl === null ? (
              <p className="sm-muted sm-small">{l('Lade …', 'Loading ...')}</p>
            ) : !ghl.status.configured ? (
              <p className="sm-warn">{l('GHL ist in der Engine nicht eingerichtet (GHL_API_TOKEN und GHL_LOCATION_ID).', 'GHL is not set up in the engine (GHL_API_TOKEN and GHL_LOCATION_ID).')}</p>
            ) : (
              <>
                <p className="sm-small">
                  {l('Die Kontakte landen im GHL-Konto', 'Contacts go to the GHL account')}: <strong>{ghl.status.location ?? '?'}</strong>. {l('Stimmt das nicht, ist die Engine mit dem falschen Konto verbunden.', 'If that is not right, the engine is connected to the wrong account.')}
                </p>
                {ghl.status.error ? <p className="sm-warn">GHL: {ghl.status.error}</p> : null}
                {fieldsMissing ? (
                  <p className="sm-warn">{l('Die Kontaktfelder Venue Token und Venue Link fehlen noch. Beim Anlegen versucht die Engine, sie zu erstellen. Klappt das nicht, lege beide als Textfelder in GHL an.', 'The contact fields Venue Token and Venue Link are missing. The engine tries to create them on the first sync. If that fails, create both as text fields in GHL.')}</p>
                ) : null}
                {failedCount > 0 ? (
                  <p className="sm-warn">
                    {l(`${failedCount} Betrieb(e) haben die WhatsApp-Nachricht nicht erhalten. Sie sind rot markiert, der Filter «Nicht zugestellt» zeigt sie.`, `${failedCount} venue(s) did not receive the WhatsApp message. They are marked red, the filter "Not delivered" shows them.`)}
                  </p>
                ) : null}
                <div className="ve-actions">
                  <button type="button" className="sm-btn sm-btn-primary" onClick={syncAll} disabled={busy}>
                    {l('Alle Orte in GHL anlegen oder aktualisieren', 'Create or update all places in GHL')}
                  </button>
                  <button type="button" className="sm-btn" onClick={checkAll} disabled={busy || businessSent.length === 0} title={l('Fragt bei GHL nach, ob die Business-Nachrichten angekommen sind', 'Asks GHL whether the business messages arrived')}>
                    {l('Zustellung prüfen', 'Check delivery')}
                  </button>
                  <span className="sm-muted sm-small">
                    {inGhl} {l('von', 'of')} {venues.length} {l('Orten sind in GHL', 'places are in GHL')}
                  </span>
                </div>
                <p className="ve-ghlline">
                  {l('Tags: vendor, venue-partner, venue-<Kategorie>. Die Business-Nachricht startet mit dem Tag venue-outreach-send, die Erinnerung nach zwei Tagen läuft im GHL-Workflow und entfällt, sobald Fotos da sind (Tag venue-photos-received).', 'Tags: vendor, venue-partner, venue-<category>. The business message starts with the tag venue-outreach-send, the reminder after two days runs in the GHL workflow and is dropped as soon as photos are in (tag venue-photos-received).')}
                </p>
              </>
            )}
            {summary ? (
              <details open={summary.failed > 0 || summary.skipped > 0}>
                <summary>
                  {summary.synced} {l('angelegt oder aktualisiert', 'created or updated')} · {summary.skipped} {l('übersprungen', 'skipped')} · {summary.failed} {l('fehlgeschlagen', 'failed')}
                </summary>
                <ul>
                  {summary.items
                    .filter((i) => !i.ok || i.reason)
                    .map((i) => (
                      <li key={i.id}>
                        <strong>{i.name}</strong>: {noteText(i.reason, l)}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="ve-filters" role="group">
            <button type="button" className={`sm-btn ${filter === 'all' ? 'sm-btn-primary' : ''}`} onClick={() => setFilter('all')}>
              {l('Alle', 'All')} ({venues.length})
            </button>
            <button type="button" className={`sm-btn ${filter === 'review' ? 'sm-btn-primary' : ''}`} onClick={() => setFilter('review')}>
              {l('Fotos prüfen', 'Photos to review')} ({counts.review})
            </button>
            <button type="button" className={`sm-btn ${filter === 'waiting' ? 'sm-btn-primary' : ''}`} onClick={() => setFilter('waiting')}>
              {l('Warten auf Fotos', 'Waiting for photos')} ({counts.waiting})
            </button>
            <button type="button" className={`sm-btn ${filter === 'ready' ? 'sm-btn-primary' : ''}`} onClick={() => setFilter('ready')}>
              {l('Für Beiträge bereit', 'Ready for posts')} ({counts.ready})
            </button>
            {failedCount > 0 || filter === 'failed' ? (
              <button type="button" className={`sm-btn ${filter === 'failed' ? 'sm-btn-primary' : ''}`} onClick={() => setFilter('failed')}>
                {l('Nicht zugestellt', 'Not delivered')} ({failedCount})
              </button>
            ) : null}
            <button type="button" className="sm-btn" onClick={seed} disabled={busy} title={l('Gleicht die Liste aus dem Guide ab: legt neue Betriebe an und füllt fehlende Angaben nach, überschreibt nichts Eingetragenes', 'Syncs the guide list: adds new venues and fills in missing details, overwrites nothing entered')}>
              {l('Liste aus dem Guide abgleichen', 'Sync list from the guide')}
            </button>
          </div>
          {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
          <ul className="ve-list">
            {shown.map((v) => (
              <VenueRow
                key={v.id}
                v={v}
                brand={brand}
                locale={locale}
                info={ghl?.infos[String(v.id)]}
                ghlOk={Boolean(ghl?.status.configured)}
                isOpen={open === v.id}
                onToggle={() => setOpen(open === v.id ? null : v.id)}
                onChanged={() => {
                  router.refresh();
                  void loadGhl();
                }}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function noteText(note: string, l: (de: string, en: string) => string): string {
  if (!note) return '';
  if (note === 'no_contact') return l('Weder Nummer noch E-Mail vorhanden', 'Neither number nor email');
  if (note.startsWith('dup:')) return l(`Gleiche Nummer wie ${note.slice(4)}, darum nicht doppelt angelegt (gleiche Gruppe? Dann reicht ein Kontakt)`, `Same number as ${note.slice(4)}, so not created twice (same group? Then one contact is enough)`);
  if (note.startsWith('error:')) return note.slice(6);
  return note;
}

const STATUS_DE: Record<string, string> = { new: 'Neu', sent: 'Versendet', opened: 'Link geöffnet', uploaded: 'Fotos da' };
const STATUS_EN: Record<string, string> = { new: 'New', sent: 'Sent', opened: 'Link opened', uploaded: 'Photos in' };

function VenueRow({ v, brand, locale, info, ghlOk, isOpen, onToggle, onChanged }: { v: VenueItem; brand: VenueBrand; locale: Locale; info?: GhlInfo; ghlOk: boolean; isOpen: boolean; onToggle: () => void; onChanged: () => void }) {
  const l = (de: string, en: string) => (locale === 'de' ? de : en);
  const [form, setForm] = useState({ contact_name: v.contactName, phone: v.phone, email: v.email, instagram: v.instagram, consent_ref: v.consentRef });
  const [consent, setConsent] = useState(Boolean(v.consentAt));
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

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
    setMsg('');
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? okText : `${l('Fehlgeschlagen', 'Failed')}${r.error ? `: ${r.error}` : ''}`);
    if (r.ok) onChanged();
    return r.ok;
  }

  const save = () =>
    run(() => call('PUT', `/api/sm-manager/venues/${v.id}`, { ...form, ...(consent && !v.consentAt ? { consent_confirmed: true } : {}) }), l('Gespeichert', 'Saved'));
  const rotate = async () => {
    if (!confirm(l('Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.', 'Create a new link? The old link will stop working.'))) return;
    await run(() => call('PUT', `/api/sm-manager/venues/${v.id}`, { rotate: true }), l('Neuer Link erzeugt', 'New link created'));
  };
  const toggleLink = () => run(() => call('PUT', `/api/sm-manager/venues/${v.id}`, { token_active: !v.tokenActive }), v.tokenActive ? l('Link gesperrt', 'Link blocked') : l('Link freigegeben', 'Link enabled'));
  const review = async (id: number, state: 'approved' | 'rejected' | 'pending') => {
    if (await run(() => call('PUT', `/api/sm-manager/venues/photos/${id}`, { review: state }), l('Gespeichert', 'Saved'))) await loadPhotos();
  };
  const remove = async (id: number) => {
    if (!confirm(l('Dieses Foto endgültig löschen?', 'Delete this photo for good?'))) return;
    if (await run(() => call('DELETE', `/api/sm-manager/venues/photos/${id}`), l('Gelöscht', 'Deleted'))) await loadPhotos();
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(l('Kopiert', 'Copied'));
    } catch {
      setMsg(l('Kopieren nicht möglich', 'Could not copy'));
    }
  };
  // Der Klick öffnet WhatsApp Web; ob die Nachricht dort wirklich abgeschickt wird, weiß Orbit nicht.
  const markSent = () => {
    void call('PUT', `/api/sm-manager/venues/${v.id}`, { mark_sent: 'whatsapp' }).then((r) => {
      if (r.ok) onChanged();
    });
  };

  const optedIn = Boolean(info?.optInAt);
  const canBusiness = ghlOk && optedIn && Boolean(info?.contactId) && v.tokenActive && Boolean(v.phone);
  const setOptIn = (value: boolean) => run(() => call('POST', `/api/sm-manager/venues/${v.id}/ghl`, { action: 'optin', value }), value ? l('Zustimmung festgehalten', 'Opt-in recorded') : l('Zustimmung entfernt', 'Opt-in removed'));
  const syncOne = () => run(() => call('POST', '/api/sm-manager/venues/ghl', { action: 'sync', ids: [v.id] }), l('In GHL abgeglichen', 'Synced to GHL'));
  const checkOne = () => run(() => call('POST', '/api/sm-manager/venues/ghl', { action: 'delivery', ids: [v.id] }), l('Zustellung geprüft', 'Delivery checked'));
  const sendBusiness = () => {
    if (!confirm(l(`WhatsApp-Business-Nachricht an ${v.spotName} jetzt senden?`, `Send the WhatsApp Business message to ${v.spotName} now?`))) return;
    void run(() => call('POST', `/api/sm-manager/venues/${v.id}/ghl`, { action: 'send' }), l('An GHL übergeben. Die Erinnerung geht nach zwei Tagen automatisch raus, falls keine Fotos kommen.', 'Handed to GHL. The reminder goes out automatically after two days if no photos arrive.'));
  };

  const rowUrl = whatsappUrl(v.phone, messageFor(brand, v.contactName, v.spotName, v.link));
  // Erinnerung nur, wenn der Link raus ist und noch keine Fotos da sind
  const remindable = (v.status === 'sent' || v.status === 'opened') && v.photos === 0;
  const rowReminderUrl = remindable ? whatsappUrl(v.phone, messageFor(brand, v.contactName, v.spotName, v.link, 'reminder')) : '';
  const panelText = messageFor(brand, form.contact_name, v.spotName, v.link);
  const panelUrl = whatsappUrl(form.phone, panelText);
  const panelReminderUrl = remindable ? whatsappUrl(form.phone, messageFor(brand, form.contact_name, v.spotName, v.link, 'reminder')) : '';
  const status = (locale === 'de' ? STATUS_DE : STATUS_EN)[v.status] ?? v.status;
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-CH', { day: 'numeric', month: 'short' }).format(new Date(iso)) : '–');
  const phoneNote =
    v.phoneSource === 'google'
      ? l('Nummer aus Google Maps, bitte vor dem ersten Versand prüfen.', 'Number from Google Maps, please check it before the first message.')
      : v.phoneSource === 'public'
        ? l('Nummer aus öffentlichen Quellen (Website oder Verzeichnis).', 'Number from public sources (website or directory).')
        : v.phoneSource === 'entered'
          ? l('Nummer vom Betrieb oder von Hand eingetragen.', 'Number entered by the venue or by hand.')
          : '';

  // Ort, Preisklasse und Einstufung laut Umgebungs-Guide
  const guideLine = [v.area, v.price, v.fit].filter(Boolean).join(' · ');

  // Zustellung der Business-WhatsApp-Nachricht, wie GHL sie meldet
  const wa = info?.waStatus ?? '';
  const waBadge =
    wa === 'failed'
      ? { cls: 've-bad', text: l('WhatsApp nicht zugestellt', 'WhatsApp not delivered') }
      : wa === 'none'
        ? { cls: 've-bad', text: l('Keine Nachricht in GHL gefunden', 'No message found in GHL') }
        : wa === 'read'
          ? { cls: 'sm-badge-ok', text: l('WhatsApp gelesen', 'WhatsApp read') }
          : wa === 'delivered'
            ? { cls: 'sm-badge-ok', text: l('WhatsApp zugestellt', 'WhatsApp delivered') }
            : wa === 'sent'
              ? { cls: '', text: l('WhatsApp gesendet', 'WhatsApp sent') }
              : null;

  return (
    <li className={`ve-item ${isOpen ? 've-open' : ''}`}>
      <div className="ve-head">
        <button type="button" className="ve-toggle" onClick={onToggle} aria-expanded={isOpen}>
          <strong>{v.spotName}</strong>
          <span className="sm-badge">{status}</span>
          {guideLine ? <span className="sm-muted sm-small">{guideLine}</span> : null}
          {cautious(v) ? <span className="sm-badge ve-bad">{l('Guide: nur mit Hinweis', 'Guide: with caveats')}</span> : null}
          {!v.tokenActive ? <span className="sm-badge">{l('Link gesperrt', 'Link blocked')}</span> : null}
          <span className="sm-muted sm-small">
            {v.photos === 0 ? l('keine Fotos', 'no photos') : `${v.approved} ${l('freigegeben', 'approved')} · ${v.pending} ${l('offen', 'to review')}`}
          </span>
          <span className={`sm-badge ${usable(v) ? 'sm-badge-ok' : ''}`}>{usable(v) ? l('bereit', 'ready') : v.consentAt ? l('Einwilligung ✓', 'Consent ✓') : l('Einwilligung offen', 'Consent open')}</span>
          {info?.contactId ? <span className="sm-badge">GHL ✓</span> : null}
          {optedIn ? <span className="sm-badge sm-badge-ok">{l('WhatsApp OK', 'WhatsApp OK')}</span> : null}
          {waBadge ? <span className={`sm-badge ${waBadge.cls}`}>{waBadge.text}</span> : null}
          {info?.waReplied ? <span className="sm-badge sm-badge-ok">{l('hat geantwortet', 'replied')}</span> : null}
        </button>
        {(rowUrl && v.tokenActive) || canBusiness ? (
          <span className="ve-send">
            {canBusiness ? (
              <button type="button" className="sm-btn sm-btn-primary" onClick={sendBusiness} disabled={busy} title={l('Schickt die Vorlage über GHL (WhatsApp Business) und startet die automatische Erinnerung', 'Sends the template through GHL (WhatsApp Business) and starts the automatic reminder')}>
                {v.status === 'new' ? l('Business-WhatsApp senden', 'Send business WhatsApp') : l('Business-WhatsApp erneut senden', 'Send business WhatsApp again')}
              </button>
            ) : null}
            {rowUrl && v.tokenActive ? (
              <a className="sm-btn ve-wa" href={rowUrl} target="_blank" rel="noreferrer" onClick={markSent} title={l('Persönlich: öffnet WhatsApp Web mit dem fertigen Text und Link', 'Personal: opens WhatsApp Web with the finished text and link')}>
                {v.phone} · WhatsApp Web
              </a>
            ) : null}
            {rowReminderUrl ? (
              <a className="sm-btn ve-wa" href={rowReminderUrl} target="_blank" rel="noreferrer" onClick={markSent} title={l('Kurze persönliche Erinnerung, wenn noch keine Fotos da sind', 'Short personal reminder while no photos are in')}>
                {l('Erinnerung', 'Reminder')}
              </a>
            ) : null}
          </span>
        ) : (
          <span className="sm-muted sm-small">{v.tokenActive ? l('Nummer fehlt (im Detail eintragen)', 'No number (add it in the details)') : l('Link gesperrt', 'Link blocked')}</span>
        )}
      </div>

      {isOpen ? (
        <div className="ve-panel">
          <div className="ve-grid">
            <label>
              {l('Ansprechperson', 'Contact person')}
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} maxLength={80} placeholder={`${v.spotName} team`} />
            </label>
            <label>
              {l('Telefon / WhatsApp (mit Landesvorwahl)', 'Phone / WhatsApp (with country code)')}
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
              {l('Nachweis der Einwilligung (der Betrieb setzt sie beim Upload selbst, hier optional)', 'Proof of consent (the venue sets it on upload, optional here)')}
              <input value={form.consent_ref} onChange={(e) => setForm({ ...form, consent_ref: e.target.value })} maxLength={200} />
            </label>
          </div>
          {guideLine ? <p className="sm-muted sm-small">{l('Laut Umgebungs-Guide', 'According to the area guide')}: {guideLine}</p> : null}
          <p className="sm-muted sm-small">
            {phoneNote}
            {v.website ? (
              <>
                {phoneNote ? ' · ' : ''}
                <a href={v.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              </>
            ) : null}
            {v.placeId ? (
              <>
                {phoneNote || v.website ? ' · ' : ''}
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
                ? `${l('Einwilligung bestätigt am', 'Consent confirmed on')} ${fmt(v.consentAt)}`
                : l('Einwilligung von Hand bestätigen (sonst setzt sie der Betrieb beim ersten Upload)', 'Confirm consent by hand (otherwise the venue sets it on the first upload)')}
            </span>
          </label>
          <div className="ve-actions">
            <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy}>
              {l('Speichern', 'Save')}
            </button>
          </div>

          <h4>{l('WhatsApp Business (GHL)', 'WhatsApp Business (GHL)')}</h4>
          <label className="ve-check">
            <input type="checkbox" checked={optedIn} disabled={busy || !ghlOk} onChange={(e) => void setOptIn(e.target.checked)} />
            <span>
              {l('Der Betrieb hat zugestimmt, dass wir ihm per WhatsApp Business schreiben (zum Beispiel nach einem ersten persönlichen Kontakt). Ohne Zustimmung bleibt der Business-Knopf aus, damit die Nummer nicht gesperrt wird.', 'The venue has agreed that we write to them via WhatsApp Business (for example after a first personal contact). Without it the business button stays off, so the number does not get blocked.')}
              {optedIn ? ` (${fmt(info?.optInAt ?? null)})` : ''}
            </span>
          </label>
          <p className="ve-ghlline">
            {info?.contactId ? `${l('GHL-Kontakt', 'GHL contact')} ${info.contactId.slice(0, 8)}… · ${l('abgeglichen', 'synced')} ${fmt(info.syncedAt)}` : l('Noch nicht in GHL angelegt.', 'Not in GHL yet.')}
            {info?.note ? ` · ${noteText(info.note, l)}` : ''}
          </p>
          {wa === 'failed' ? (
            <p className="sm-warn">
              {l('Die WhatsApp-Nachricht konnte nicht zugestellt werden', 'The WhatsApp message could not be delivered')}
              {info?.waError ? `: ${info.waError}` : ''}. {l('Häufige Gründe: Die Nummer hat kein WhatsApp, die Nummer ist falsch oder die Vorlage ist bei Meta noch nicht genehmigt. Prüfe die Nummer (Google Maps) oder schreibe persönlich über WhatsApp Web.', 'Common reasons: the number has no WhatsApp, the number is wrong, or the template is not approved by Meta yet. Check the number (Google Maps) or write personally via WhatsApp Web.')}
            </p>
          ) : null}
          {wa === 'none' ? (
            <p className="sm-warn">{l('In GHL ist keine ausgehende WhatsApp-Nachricht zu finden. Prüfe, ob die Vorlage genehmigt und der Workflow aktiv ist (Auslöser: Tag venue-outreach-send).', 'No outgoing WhatsApp message can be found in GHL. Check that the template is approved and the workflow is active (trigger: tag venue-outreach-send).')}</p>
          ) : null}
          {wa === 'sent' ? <p className="ve-ghlline">{l('Gesendet, GHL hat noch keine Zustellung gemeldet.', 'Sent, GHL has not reported delivery yet.')}</p> : null}
          {info?.waStatusAt && wa ? <p className="ve-ghlline">{l('Stand der Prüfung', 'Checked')}: {fmt(info.waStatusAt)}</p> : null}
          <div className="ve-actions">
            <button type="button" className="sm-btn" onClick={syncOne} disabled={busy || !ghlOk}>
              {l('In GHL anlegen oder aktualisieren', 'Create or update in GHL')}
            </button>
            {canBusiness ? (
              <button type="button" className="sm-btn sm-btn-primary" onClick={sendBusiness} disabled={busy}>
                {l('Business-WhatsApp senden', 'Send business WhatsApp')}
              </button>
            ) : null}
            {info?.contactId && v.sentAt && v.lastChannel === 'whatsapp_business' ? (
              <button type="button" className="sm-btn" onClick={checkOne} disabled={busy || !ghlOk}>
                {l('Zustellung prüfen', 'Check delivery')}
              </button>
            ) : null}
          </div>
          {info?.contactId ? <p className="ve-ghlline">{l('Die Erinnerung nach zwei Tagen ohne Fotos verschickt der GHL-Workflow automatisch.', 'The reminder after two days without photos is sent automatically by the GHL workflow.')}</p> : null}

          <h4>{l('Persönlicher Link', 'Personal link')}</h4>
          <div className="ve-link">
            <code>{v.link}</code>
          </div>
          <div className="ve-actions">
            <button type="button" className="sm-btn" onClick={() => copy(v.link)}>
              {l('Link kopieren', 'Copy link')}
            </button>
            <button type="button" className="sm-btn" onClick={() => copy(panelText)}>
              {l('Nachricht kopieren', 'Copy message')}
            </button>
            {panelUrl && v.tokenActive ? (
              <a className="sm-btn" href={panelUrl} target="_blank" rel="noreferrer" onClick={markSent}>
                {l('In WhatsApp Web öffnen', 'Open in WhatsApp Web')}
              </a>
            ) : null}
            {panelReminderUrl && v.tokenActive ? (
              <a className="sm-btn" href={panelReminderUrl} target="_blank" rel="noreferrer" onClick={markSent}>
                {l('Erinnerung in WhatsApp Web', 'Reminder in WhatsApp Web')}
              </a>
            ) : null}
            <button type="button" className="sm-btn" onClick={toggleLink} disabled={busy}>
              {v.tokenActive ? l('Link sperren', 'Block link') : l('Link freigeben', 'Enable link')}
            </button>
            <button type="button" className="sm-btn" onClick={rotate} disabled={busy}>
              {l('Neuen Link erzeugen', 'New link')}
            </button>
          </div>
          <p className="sm-muted sm-small">
            {l('Link geöffnet:', 'Link opened:')} {fmt(v.openedAt)} · {l('Versendet:', 'Sent:')} {fmt(v.sentAt)}
          </p>

          <h4>{l('Fotos', 'Photos')}</h4>
          {photos === null ? (
            <p className="sm-muted sm-small">{l('Lädt …', 'Loading …')}</p>
          ) : photos.length === 0 ? (
            <p className="sm-muted sm-small">{l('Noch keine Fotos hochgeladen.', 'No photos uploaded yet.')}</p>
          ) : (
            <ul className="ve-photos">
              {photos.map((p) => (
                <li key={p.id} className={`ve-photo ve-${p.review}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/sm-manager/venues/photos/${p.id}`} alt={p.caption || p.filename} loading="lazy" />
                  <p className="sm-small">{p.caption || <span className="sm-muted">{l('ohne Beschreibung', 'no description')}</span>}</p>
                  <div className="ve-actions">
                    <button type="button" className={`sm-btn ${p.review === 'approved' ? 'sm-btn-primary' : ''}`} onClick={() => review(p.id, p.review === 'approved' ? 'pending' : 'approved')} disabled={busy}>
                      {p.review === 'approved' ? l('Freigegeben ✓', 'Approved ✓') : l('Freigeben', 'Approve')}
                    </button>
                    <button type="button" className="sm-btn" onClick={() => review(p.id, p.review === 'rejected' ? 'pending' : 'rejected')} disabled={busy}>
                      {p.review === 'rejected' ? l('Abgelehnt', 'Rejected') : l('Ablehnen', 'Reject')}
                    </button>
                    <button type="button" className="sm-btn" onClick={() => remove(p.id)} disabled={busy}>
                      {l('Löschen', 'Delete')}
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
