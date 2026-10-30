import { sql } from "@/lib/db";
import type { Lang } from "./quote";
import type { OnboardingTemplateItem, QuoteSettings } from "./settings-shared";
import type { Quote } from "./store";

/**
 * Onboarding-Checkliste nach der Annahme einer Offerte. Sie entsteht aus der Vorlage in den Einstellungen und
 * wird an den Kunden angepasst: Punkte mit Bedingung (Smart Locks, Channel Manager, Datenübernahme) kommen nur
 * dazu, wenn Paket oder Gespräch dafür sprechen. Kunde (über den Link) und Team (in Orbit) arbeiten dieselbe Liste ab.
 */

export type OnboardingPhase = "start" | "setup" | "golive";
export type OnboardingOwner = "customer" | "elev8" | "both";

export type OnboardingItem = {
  id: string;
  phase: OnboardingPhase;
  title: string;
  detail: string;
  owner: OnboardingOwner;
  link: string | null;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
};

export type Onboarding = {
  id: string;
  quoteId: string;
  token: string;
  language: Lang;
  addressForm: "du" | "sie";
  company: string;
  contactName: string;
  contactEmail: string;
  ghlContactId: string | null;
  ownerName: string;
  ownerEmail: string;
  items: OnboardingItem[];
  status: "open" | "live";
  liveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

function toOnboarding(r: Row): Onboarding {
  return {
    id: r.id as string,
    quoteId: r.quote_id as string,
    token: r.token as string,
    language: (r.language as Lang) ?? "de",
    addressForm: (r.address_form as "du" | "sie") ?? "sie",
    company: (r.company as string) ?? "",
    contactName: (r.contact_name as string) ?? "",
    contactEmail: (r.contact_email as string) ?? "",
    ghlContactId: (r.ghl_contact_id as string) ?? null,
    ownerName: (r.owner_name as string) ?? "",
    ownerEmail: (r.owner_email as string) ?? "",
    items: (r.items as OnboardingItem[]) ?? [],
    status: (r.status as Onboarding["status"]) ?? "open",
    liveAt: iso(r.live_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!
  };
}

// ── Checkliste aus der Vorlage ───────────────────────────────────────

/** Alles, was wir über den Kunden wissen, als ein Text – Grundlage für die Bedingungen der Vorlage. */
function customerText(q: Quote): string {
  const a = q.analysis;
  return [a?.summary, ...(a?.needs ?? []), a?.pricingDiscussed, a?.onboardingNote, q.texts.intro, q.texts.notes, q.texts.closing]
    .filter(Boolean)
    .join("\n");
}

const MATCHES: Record<Exclude<OnboardingTemplateItem["condition"], "always">, (q: Quote, text: string) => boolean> = {
  smart_lock: (_q, text) => /smart ?lock|schloss|schlösser|seam|nuki|igloo|türcode|zutrittscode|keyless/i.test(text),
  // Per Unit enthält die Kanalanbindung; bei Per Booking nur mit Channel Manager. Sonst, wenn OTAs Thema waren.
  channel_manager: (q, text) =>
    q.config.model === "per_unit" ||
    (q.config.model === "per_booking" && q.config.channelManager) ||
    /airbnb|booking\.com|channel ?manager|kanäle|ota/i.test(text),
  migration: (_q, text) =>
    /migration|migrier|übernehm|übernahme|import|bestehende buchungen|bisherig|smoobu|guesty|hostaway|lodgify|moonbook|beds24|hostify|pms/i.test(text)
};

export function applies(item: OnboardingTemplateItem, q: Quote): boolean {
  if (item.condition === "always") return true;
  return MATCHES[item.condition](q, customerText(q));
}

export function buildChecklist(q: Quote, settings: QuoteSettings): OnboardingItem[] {
  const lang = q.language;
  const bookingUrl = settings.onboarding?.bookingUrl?.trim() || null;
  return (settings.onboarding?.items ?? [])
    .filter((item) => applies(item, q))
    .map((item) => ({
      id: item.id,
      phase: item.phase,
      title: item.title[lang] || item.title.de,
      detail: item.detail[lang] || item.detail.de,
      owner: item.owner,
      link: item.link === "booking" ? bookingUrl : null,
      done: false,
      doneAt: null,
      doneBy: null
    }));
}

export function progress(items: OnboardingItem[]): { done: number; total: number; percent: number } {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

// ── Datenbank ────────────────────────────────────────────────────────

export async function createOnboarding(q: Quote, settings: QuoteSettings): Promise<Onboarding> {
  const acc = q.acceptance;
  const items = buildChecklist(q, settings);
  const [row] = await sql<Row[]>`
    INSERT INTO onboardings (quote_id, language, address_form, company, contact_name, contact_email, ghl_contact_id,
      owner_name, owner_email, items)
    VALUES (${q.id}, ${q.language}, ${q.texts.addressForm}, ${acc?.company || q.recipient.company || null},
      ${acc?.name || q.recipient.name || null}, ${acc?.email || q.recipient.email || null}, ${q.ghlContactId},
      ${q.contactPerson?.name || q.sentByName || q.ownerName || null}, ${q.contactPerson?.email || q.sentByEmail || q.ownerEmail || null},
      ${sql.json(items as never)})
    ON CONFLICT (quote_id) DO UPDATE SET updated_at = now()
    RETURNING *`;
  return toOnboarding(row);
}

export async function getOnboarding(id: string): Promise<Onboarding | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<Row[]>`SELECT * FROM onboardings WHERE id = ${id}`;
  return rows.length ? toOnboarding(rows[0]) : null;
}

export async function getOnboardingByToken(token: string): Promise<Onboarding | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const rows = await sql<Row[]>`SELECT * FROM onboardings WHERE token = ${token}`;
  return rows.length ? toOnboarding(rows[0]) : null;
}

export async function getOnboardingByQuote(quoteId: string): Promise<Onboarding | null> {
  const rows = await sql<Row[]>`SELECT * FROM onboardings WHERE quote_id = ${quoteId}`;
  return rows.length ? toOnboarding(rows[0]) : null;
}

export async function listOnboardings(limit = 200): Promise<Onboarding[]> {
  const rows = await sql<Row[]>`
    SELECT * FROM onboardings ORDER BY (status = 'open') DESC, created_at DESC LIMIT ${limit}`;
  return rows.map(toOnboarding);
}

/**
 * Hakt einen Punkt ab oder öffnet ihn wieder. Kunden dürfen nur ihre eigenen und gemeinsame Punkte ändern;
 * das Team alle. Gibt die aktualisierte Checkliste zurück oder null, wenn der Punkt nicht geändert werden darf.
 */
export async function setItemDone(
  onboarding: Onboarding,
  itemId: string,
  done: boolean,
  by: { name: string; asCustomer: boolean }
): Promise<Onboarding | null> {
  const item = onboarding.items.find((i) => i.id === itemId);
  if (!item) return null;
  if (by.asCustomer && item.owner === "elev8") return null;
  const items = onboarding.items.map((i) =>
    i.id === itemId ? { ...i, done, doneAt: done ? new Date().toISOString() : null, doneBy: done ? by.name : null } : i
  );
  const [row] = await sql<Row[]>`
    UPDATE onboardings SET items = ${sql.json(items as never)}, updated_at = now()
    WHERE id = ${onboarding.id} RETURNING *`;
  return row ? toOnboarding(row) : null;
}

export async function setOnboardingStatus(id: string, status: Onboarding["status"]): Promise<Onboarding | null> {
  const [row] = await sql<Row[]>`
    UPDATE onboardings SET status = ${status}, live_at = ${status === "live" ? new Date().toISOString() : null}, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  return row ? toOnboarding(row) : null;
}
