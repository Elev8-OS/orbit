import { sql } from '@/lib/db';
import { EngineError, engine } from '@/lib/sm-manager/client';
import { ensureVenueTables, getVenue, listVenues, updateVenue } from './store';

// Verbindung der Orte zu GHL (WhatsApp Business). Die Engine legt die Kontakte an und setzt Tags; die Nachricht und die
// Erinnerung nach zwei Tagen verschickt ein GHL-Workflow. Hier steht, was Orbit pro Ort dazu festhält, auch ob eine
// WhatsApp-Nachricht zugestellt wurde. Festnetznummern werden nicht gesperrt: auch sie können WhatsApp haben.

export type WaStatus = '' | 'sent' | 'delivered' | 'read' | 'failed' | 'none';
export type GhlInfo = { contactId: string; optInAt: string | null; syncedAt: string | null; note: string; waStatus: WaStatus; waStatusAt: string | null; waError: string; waReplied: boolean };
export type GhlStatus = { configured: boolean; locationId?: string; location?: string | null; fields?: { venue_token?: boolean; venue_link?: boolean }; error?: string | null };
export type SyncSummary = { synced: number; skipped: number; failed: number; items: { id: number; name: string; ok: boolean; reason: string }[] };

export class GhlError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

let ready: Promise<void> | null = null;

/** Zusätzliche Spalten, beim ersten Zugriff angelegt (wie die übrigen Tabellen der Orte). */
export function ensureGhlColumns(): Promise<void> {
  ready ??= (async () => {
    await ensureVenueTables();
    await sql`alter table venue_contacts add column if not exists ghl_contact_id text`;
    await sql`alter table venue_contacts add column if not exists whatsapp_optin_at timestamptz`;
    await sql`alter table venue_contacts add column if not exists ghl_synced_at timestamptz`;
    await sql`alter table venue_contacts add column if not exists ghl_note text`;
    await sql`alter table venue_contacts add column if not exists wa_status text`;
    await sql`alter table venue_contacts add column if not exists wa_status_at timestamptz`;
    await sql`alter table venue_contacts add column if not exists wa_error text`;
    await sql`alter table venue_contacts add column if not exists wa_replied boolean not null default false`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

type InfoRow = {
  id: number;
  ghl_contact_id: string | null;
  whatsapp_optin_at: Date | null;
  ghl_synced_at: Date | null;
  ghl_note: string | null;
  wa_status: string | null;
  wa_status_at: Date | null;
  wa_error: string | null;
  wa_replied: boolean;
};

export async function ghlInfoMap(): Promise<Record<number, GhlInfo>> {
  await ensureGhlColumns();
  const rows = await sql<InfoRow[]>`select id, ghl_contact_id, whatsapp_optin_at, ghl_synced_at, ghl_note, wa_status, wa_status_at, wa_error, wa_replied from venue_contacts`;
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        contactId: r.ghl_contact_id ?? '',
        optInAt: r.whatsapp_optin_at ? r.whatsapp_optin_at.toISOString() : null,
        syncedAt: r.ghl_synced_at ? r.ghl_synced_at.toISOString() : null,
        note: r.ghl_note ?? '',
        waStatus: (r.wa_status ?? '') as WaStatus,
        waStatusAt: r.wa_status_at ? r.wa_status_at.toISOString() : null,
        waError: r.wa_error ?? '',
        waReplied: r.wa_replied
      }
    ])
  );
}

type Item = { id: number; spotName: string; token: string; link: string; contactName: string; phone: string; email: string; website: string; optIn: boolean; skip?: string };
type EngineResult = { id: number; ok: boolean; contactId?: string; skipped?: string; error?: string };

/**
 * Alle Orte (oder nur die genannten) als Kontakte in GHL anlegen oder aktualisieren.
 * Zwei Orte mit derselben Nummer werden nicht doppelt angelegt: GHL würde sie zu einem Kontakt verschmelzen.
 */
export async function syncToGhl(onlyIds?: number[]): Promise<SyncSummary> {
  await ensureGhlColumns();
  const all = await listVenues();
  const info = await ghlInfoMap();
  const base = (process.env.AUTH_URL ?? 'https://myorbit.elev8-suite.com').replace(/\/$/, '');
  const owner = new Map<string, string>();
  const items: Item[] = all.map((v) => {
    const digits = v.phone.replace(/\D/g, '');
    let skip: string | undefined;
    if (digits) {
      const first = owner.get(digits);
      if (first) skip = `dup:${first}`;
      else owner.set(digits, v.spotName);
    }
    return { id: v.id, spotName: v.spotName, token: v.token, link: `${base}/contribute/${v.token}`, contactName: v.contactName, phone: v.phone, email: v.email, website: v.website, optIn: Boolean(info[v.id]?.optInAt), ...(skip ? { skip } : {}) };
  });
  const todo = onlyIds ? items.filter((i) => onlyIds.includes(i.id)) : items;
  const names = new Map(all.map((v) => [v.id, v.spotName]));

  // In kleinen Paketen, damit ein einzelner Aufruf bei der Engine nicht zu lange dauert.
  const results: EngineResult[] = [];
  let fatal = '';
  for (let i = 0; i < todo.length && !fatal; i += 6) {
    const chunk = todo.slice(i, i + 6);
    try {
      const r = await engine<{ results: EngineResult[] }>('/outreach/sync', { method: 'POST', body: { venues: chunk } });
      results.push(...r.results);
    } catch (e) {
      fatal = e instanceof Error ? e.message : 'failed';
      for (const c of chunk) results.push({ id: c.id, ok: false, error: fatal });
    }
  }
  for (const c of todo.slice(results.length)) results.push({ id: c.id, ok: false, error: fatal || 'not processed' });

  const out: SyncSummary = { synced: 0, skipped: 0, failed: 0, items: [] };
  for (const r of results) {
    const name = names.get(r.id) ?? String(r.id);
    if (r.ok && r.contactId) {
      await sql`update venue_contacts set ghl_contact_id = ${r.contactId}, ghl_synced_at = now(), ghl_note = '' where id = ${r.id}`;
      out.synced++;
      out.items.push({ id: r.id, name, ok: true, reason: '' });
    } else if (r.skipped) {
      await sql`update venue_contacts set ghl_note = ${r.skipped} where id = ${r.id}`;
      out.skipped++;
      out.items.push({ id: r.id, name, ok: false, reason: r.skipped });
    } else {
      const reason = `error:${r.error ?? ''}`.slice(0, 300);
      await sql`update venue_contacts set ghl_note = ${reason} where id = ${r.id}`;
      out.failed++;
      out.items.push({ id: r.id, name, ok: false, reason });
    }
  }
  return out;
}

/** Zustimmung zu WhatsApp-Nachrichten festhalten (und in GHL als Tag spiegeln, falls der Kontakt schon besteht). */
export async function setOptIn(id: number, value: boolean): Promise<void> {
  await ensureGhlColumns();
  if (!(await getVenue(id))) throw new GhlError(404, 'Place not found');
  await sql`update venue_contacts set whatsapp_optin_at = ${value ? new Date() : null} where id = ${id}`;
  const info = (await ghlInfoMap())[id];
  if (info?.contactId) await engine('/outreach/optin', { method: 'POST', body: { contactId: info.contactId, value } }).catch(() => undefined);
}

/** Startet den GHL-Workflow für diesen Ort: erste Nachricht jetzt, Erinnerung nach zwei Tagen, wenn keine Fotos da sind. */
export async function sendWhatsapp(id: number): Promise<void> {
  await ensureGhlColumns();
  const v = await getVenue(id);
  if (!v) throw new GhlError(404, 'Place not found');
  const info = (await ghlInfoMap())[id];
  if (!info?.optInAt) throw new GhlError(409, 'Opt-in missing: tick that the venue agreed to WhatsApp messages first.');
  if (!v.tokenActive) throw new GhlError(409, 'The link of this venue is blocked.');
  if (!v.phone) throw new GhlError(409, 'The venue has no phone number.');
  const sync = await syncToGhl([id]);
  const item = sync.items[0];
  if (!item?.ok) throw new GhlError(409, `Not synced to GHL: ${item?.reason || 'unknown'}`);
  const fresh = (await ghlInfoMap())[id];
  try {
    await engine('/outreach/send', { method: 'POST', body: { contactId: fresh.contactId, optIn: true } });
  } catch (e) {
    throw new GhlError(e instanceof EngineError ? e.status : 502, e instanceof Error ? e.message : 'failed');
  }
  // Neue Runde: der alte Zustellstatus gilt nicht mehr.
  await sql`update venue_contacts set wa_status = null, wa_status_at = null, wa_error = '', wa_replied = false where id = ${id}`;
  await updateVenue(id, { sent_at: new Date(), last_channel: 'whatsapp_business', ...(v.status === 'new' ? { status: 'sent' as const } : {}) });
}

type DeliveryResult = { contactId: string; status: string; error?: string; replied?: boolean };

/**
 * Fragt bei GHL nach, was aus den Business-WhatsApp-Nachrichten geworden ist, und merkt sich den Stand pro Ort.
 * Ohne Angabe: alle Orte, deren Nachricht jünger als 14 Tage ist und noch nicht als zugestellt oder gescheitert gilt.
 * Mit Angabe: genau diese Orte, auch wenn sie schon als zugestellt gelten (zum Beispiel für "gelesen" und "geantwortet").
 */
export async function checkDelivery(onlyIds?: number[]): Promise<{ checked: number }> {
  await ensureGhlColumns();
  type Row = { id: number; contact: string; sent_at: Date | null };
  const rows =
    onlyIds && onlyIds.length > 0
      ? await sql<Row[]>`select id, ghl_contact_id as contact, sent_at from venue_contacts where id in ${sql(onlyIds)} and ghl_contact_id is not null and sent_at is not null`
      : await sql<Row[]>`select id, ghl_contact_id as contact, sent_at from venue_contacts
          where ghl_contact_id is not null and sent_at is not null and last_channel = 'whatsapp_business'
            and (wa_status is null or wa_status in ('sent', 'none')) and sent_at > now() - interval '14 days' limit 24`;
  let checked = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    let res: { results: DeliveryResult[] };
    try {
      res = await engine<{ results: DeliveryResult[] }>('/outreach/delivery', { method: 'POST', body: { contactIds: chunk.map((r) => r.contact) } });
    } catch (e) {
      console.error('GHL delivery check failed:', e);
      continue;
    }
    for (const r of res.results) {
      const row = chunk.find((c) => c.contact === r.contactId);
      if (!row || r.status === 'error') continue;
      // Direkt nach dem Senden braucht GHL einen Moment, bis die Nachricht im Verlauf steht: das ist noch kein Fehler.
      const fresh = row.sent_at ? Date.now() - row.sent_at.getTime() < 10 * 60 * 1000 : false;
      const status = r.status === 'none' && fresh ? 'sent' : r.status;
      await sql`update venue_contacts set wa_status = ${status}, wa_status_at = now(), wa_error = ${r.error ?? ''}, wa_replied = ${Boolean(r.replied)} where id = ${row.id}`;
      checked++;
    }
  }
  return { checked };
}

/** Fotos sind da: der GHL-Workflow schickt keine Erinnerung mehr. Darf den Upload nie stören. */
export async function notifyPhotosReceived(venueId: number): Promise<void> {
  try {
    await ensureGhlColumns();
    const rows = await sql<{ c: string | null }[]>`select ghl_contact_id as c from venue_contacts where id = ${venueId}`;
    const contactId = rows[0]?.c;
    if (contactId) await engine('/outreach/photos-received', { method: 'POST', body: { contactId } });
  } catch (e) {
    console.error('GHL photos-received failed:', e);
  }
}
