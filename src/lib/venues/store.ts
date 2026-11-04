import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

export const MAX_PHOTOS = 12;

export type VenueStatus = "new" | "sent" | "opened" | "uploaded";
export type Review = "pending" | "approved" | "rejected";

export type Venue = {
  id: number;
  spotName: string;
  token: string;
  tokenActive: boolean;
  contactName: string;
  phone: string;
  email: string;
  instagram: string;
  consentRef: string;
  consentAt: string | null;
  status: VenueStatus;
  sentAt: string | null;
  openedAt: string | null;
  lastChannel: string;
};
export type VenueSummary = Venue & { photos: number; pending: number; approved: number };
export type Photo = { id: number; venueId: number; storageKey: string; filename: string; contentType: string; bytes: number; caption: string; rightsOk: boolean; review: Review; createdAt: string };

type VenueRow = {
  id: number;
  spot_name: string;
  token: string;
  token_active: boolean;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  consent_ref: string | null;
  consent_at: Date | null;
  status: string;
  sent_at: Date | null;
  opened_at: Date | null;
  last_channel: string | null;
};
type PhotoRow = { id: number; venue_id: number; storage_key: string; filename: string | null; content_type: string | null; bytes: number | null; caption: string | null; rights_ok: boolean; review: string; created_at: Date };

let ready: Promise<void> | null = null;

/** Legt die Tabellen beim ersten Zugriff an (kein separates Migrationsskript nötig). */
export function ensureVenueTables(): Promise<void> {
  ready ??= (async () => {
    await sql`create table if not exists venue_contacts (
      id serial primary key,
      spot_name text not null unique,
      token text not null unique,
      token_active boolean not null default true,
      contact_name text,
      phone text,
      email text,
      instagram text,
      consent_ref text,
      consent_at timestamptz,
      status text not null default 'new',
      sent_at timestamptz,
      opened_at timestamptz,
      last_channel text,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists venue_photos (
      id serial primary key,
      venue_id integer not null references venue_contacts(id) on delete cascade,
      storage_key text not null,
      filename text,
      content_type text,
      bytes integer,
      caption text,
      rights_ok boolean not null default false,
      review text not null default 'pending',
      created_at timestamptz not null default now()
    )`;
    await sql`create index if not exists venue_photos_venue_idx on venue_photos (venue_id)`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toVenue(r: VenueRow): Venue {
  return {
    id: r.id,
    spotName: r.spot_name,
    token: r.token,
    tokenActive: r.token_active,
    contactName: r.contact_name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    instagram: r.instagram ?? "",
    consentRef: r.consent_ref ?? "",
    consentAt: iso(r.consent_at),
    status: (r.status as VenueStatus) ?? "new",
    sentAt: iso(r.sent_at),
    openedAt: iso(r.opened_at),
    lastChannel: r.last_channel ?? ""
  };
}

function toPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    venueId: r.venue_id,
    storageKey: r.storage_key,
    filename: r.filename ?? "",
    contentType: r.content_type ?? "image/jpeg",
    bytes: r.bytes ?? 0,
    caption: r.caption ?? "",
    rightsOk: r.rights_ok,
    review: (r.review as Review) ?? "pending",
    createdAt: r.created_at.toISOString()
  };
}

function newToken(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${slug}-${randomBytes(12).toString("base64url")}`;
}

/** Instagram-Name ohne @ und ohne Link; leer, wenn er nicht wie ein Name aussieht. */
export function cleanInstagram(input: string): string {
  const v = input.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : "";
}

/** Telefonnummer auf Ziffern mit führendem + reduziert. */
export function cleanPhone(input: string): string {
  const v = input.trim().replace(/[^\d+]/g, "");
  const plus = v.startsWith("+") ? "+" : "";
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? plus + digits : "";
}

export async function createVenues(items: { name: string; instagram?: string }[]): Promise<number> {
  await ensureVenueTables();
  let created = 0;
  for (const it of items) {
    const name = it.name.trim();
    if (!name) continue;
    const rows = await sql`insert into venue_contacts (spot_name, token, instagram)
      values (${name}, ${newToken(name)}, ${it.instagram ? cleanInstagram(it.instagram) : null})
      on conflict (spot_name) do nothing returning id`;
    created += rows.length;
  }
  return created;
}

export async function listVenues(): Promise<VenueSummary[]> {
  await ensureVenueTables();
  const rows = await sql<(VenueRow & { photos: number; pending: number; approved: number })[]>`
    select v.*, coalesce(p.total, 0) as photos, coalesce(p.pending, 0) as pending, coalesce(p.approved, 0) as approved
    from venue_contacts v
    left join (
      select venue_id, count(*)::int as total,
             (count(*) filter (where review = 'pending'))::int as pending,
             (count(*) filter (where review = 'approved'))::int as approved
      from venue_photos group by venue_id
    ) p on p.venue_id = v.id
    order by v.spot_name`;
  return rows.map((r) => ({ ...toVenue(r), photos: r.photos, pending: r.pending, approved: r.approved }));
}

export async function getVenue(id: number): Promise<Venue | null> {
  await ensureVenueTables();
  const rows = await sql<VenueRow[]>`select * from venue_contacts where id = ${id}`;
  return rows[0] ? toVenue(rows[0]) : null;
}

/** Nur aktive Links; ein gesperrter oder erneuerter Link liefert nichts. */
export async function getVenueByToken(token: string): Promise<Venue | null> {
  if (!token || token.length > 80) return null;
  await ensureVenueTables();
  const rows = await sql<VenueRow[]>`select * from venue_contacts where token = ${token} and token_active = true`;
  return rows[0] ? toVenue(rows[0]) : null;
}

export type VenuePatch = Partial<{ contact_name: string; phone: string; email: string; instagram: string; consent_ref: string; consent_at: Date | null; status: VenueStatus; sent_at: Date; last_channel: string; token_active: boolean }>;
const PATCH_KEYS = ["contact_name", "phone", "email", "instagram", "consent_ref", "consent_at", "status", "sent_at", "last_channel", "token_active"] as const;

export async function updateVenue(id: number, patch: VenuePatch): Promise<void> {
  await ensureVenueTables();
  const clean: Record<string, string | boolean | Date | null> = {};
  for (const k of PATCH_KEYS) {
    const v = patch[k];
    if (v !== undefined) clean[k] = v;
  }
  const cols = Object.keys(clean);
  if (cols.length === 0) return;
  await sql`update venue_contacts set ${sql(clean, ...cols)} where id = ${id}`;
}

/** Neuer Code; der alte Link ist damit sofort ungültig. */
export async function rotateToken(id: number): Promise<string | null> {
  const v = await getVenue(id);
  if (!v) return null;
  const token = newToken(v.spotName);
  await sql`update venue_contacts set token = ${token}, token_active = true where id = ${id}`;
  return token;
}

export async function markOpened(id: number): Promise<void> {
  await sql`update venue_contacts set opened_at = coalesce(opened_at, now()),
    status = case when status in ('new', 'sent') then 'opened' else status end where id = ${id}`;
}

export async function markUploaded(id: number): Promise<void> {
  await sql`update venue_contacts set status = 'uploaded' where id = ${id}`;
}

export async function countPhotos(venueId: number): Promise<number> {
  await ensureVenueTables();
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from venue_photos where venue_id = ${venueId}`;
  return rows[0]?.n ?? 0;
}

export async function addPhoto(p: { venueId: number; storageKey: string; filename: string; contentType: string; bytes: number; caption: string; rightsOk: boolean }): Promise<number> {
  await ensureVenueTables();
  const rows = await sql<{ id: number }[]>`insert into venue_photos (venue_id, storage_key, filename, content_type, bytes, caption, rights_ok)
    values (${p.venueId}, ${p.storageKey}, ${p.filename}, ${p.contentType}, ${p.bytes}, ${p.caption}, ${p.rightsOk}) returning id`;
  return rows[0].id;
}

export async function listPhotos(venueId: number): Promise<Photo[]> {
  await ensureVenueTables();
  const rows = await sql<PhotoRow[]>`select * from venue_photos where venue_id = ${venueId} order by id`;
  return rows.map(toPhoto);
}

export async function getPhoto(id: number): Promise<Photo | null> {
  await ensureVenueTables();
  const rows = await sql<PhotoRow[]>`select * from venue_photos where id = ${id}`;
  return rows[0] ? toPhoto(rows[0]) : null;
}

export async function reviewPhoto(id: number, review: Review): Promise<void> {
  await sql`update venue_photos set review = ${review} where id = ${id}`;
}

export async function deletePhoto(id: number): Promise<string | null> {
  const rows = await sql<{ storage_key: string }[]>`delete from venue_photos where id = ${id} returning storage_key`;
  return rows[0]?.storage_key ?? null;
}
