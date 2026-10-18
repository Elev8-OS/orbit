import { sql } from "@/lib/db";

export type MesseEvent = {
  id: string;
  slug: string;
  name: string;
  lang: "de" | "en";
  datesLabel: string;
  booth: string;
  timeZone: string;
  prizeTitle: string;
  prizeDetail: string;
  drawAt: Date | null;
  demoUrl: string;
  termsUrl: string;
  privacyUrl: string;
  websiteUrl: string;
  metaPixelId: string;
  googleTagId: string;
  linkedinPartnerId: string;
  ghlTags: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MesseLead = {
  id: string;
  eventId: string;
  ticket: string;
  name: string;
  preferredChannel: "whatsapp" | "email";
  whatsapp: string;
  email: string;
  units: string;
  airbnbUrl: string;
  airbnbListingId: string;
  airbnbHostId: string;
  company: string;
  pms: string;
  /** Antwort auf die Quizfrage; quizCorrect null = ohne Quiz teilgenommen */
  quizAnswer: string;
  quizCorrect: boolean | null;
  score: number;
  tier: "hot" | "warm" | "cold" | "open";
  consentMarketing: boolean;
  source: string;
  utm: Record<string, string>;
  lang: string;
  completed: boolean;
  ghlStatus: "pending" | "ok" | "error" | "skipped";
  ghlContactId: string | null;
  ghlError: string | null;
  winnerAt: Date | null;
  createdAt: Date;
};

type Row = Record<string, unknown>;

function toEvent(r: Row): MesseEvent {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    lang: r.lang === "en" ? "en" : "de",
    datesLabel: String(r.dates_label ?? ""),
    booth: String(r.booth ?? ""),
    timeZone: String(r.time_zone ?? "Asia/Makassar"),
    prizeTitle: String(r.prize_title ?? ""),
    prizeDetail: String(r.prize_detail ?? ""),
    drawAt: (r.draw_at as Date | null) ?? null,
    demoUrl: String(r.demo_url ?? ""),
    termsUrl: String(r.terms_url ?? ""),
    privacyUrl: String(r.privacy_url ?? ""),
    websiteUrl: String(r.website_url ?? ""),
    metaPixelId: String(r.meta_pixel_id ?? ""),
    googleTagId: String(r.google_tag_id ?? ""),
    linkedinPartnerId: String(r.linkedin_partner_id ?? ""),
    ghlTags: (r.ghl_tags as string[] | null) ?? [],
    active: Boolean(r.active),
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date
  };
}

function toLead(r: Row): MesseLead {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    ticket: String(r.ticket),
    name: String(r.name),
    preferredChannel: r.preferred_channel === "email" ? "email" : "whatsapp",
    whatsapp: String(r.whatsapp ?? ""),
    email: String(r.email ?? ""),
    units: String(r.units ?? ""),
    airbnbUrl: String(r.airbnb_url ?? ""),
    airbnbListingId: String(r.airbnb_listing_id ?? ""),
    airbnbHostId: String(r.airbnb_host_id ?? ""),
    company: String(r.company ?? ""),
    pms: String(r.pms ?? ""),
    quizAnswer: String(r.quiz_answer ?? ""),
    quizCorrect: r.quiz_correct === null || r.quiz_correct === undefined ? null : Boolean(r.quiz_correct),
    score: Number(r.score ?? 0),
    tier: r.tier === "hot" || r.tier === "warm" || r.tier === "open" ? r.tier : "cold",
    consentMarketing: Boolean(r.consent_marketing),
    source: String(r.source ?? ""),
    utm: (r.utm as Record<string, string> | null) ?? {},
    lang: String(r.lang ?? "de"),
    completed: r.completed !== false,
    ghlStatus: (r.ghl_status as MesseLead["ghlStatus"]) ?? "pending",
    ghlContactId: (r.ghl_contact_id as string | null) ?? null,
    ghlError: (r.ghl_error as string | null) ?? null,
    winnerAt: (r.winner_at as Date | null) ?? null,
    createdAt: r.created_at as Date
  };
}

// ── Messen ──────────────────────────────────────────────────

export type EventSummary = MesseEvent & { leads: number; hot: number; lastLeadAt: Date | null };

export async function listEvents(): Promise<EventSummary[]> {
  const rows = await sql`
    SELECT e.*,
      (SELECT count(*) FROM messe_leads l WHERE l.event_id = e.id)::int AS leads,
      (SELECT count(*) FROM messe_leads l WHERE l.event_id = e.id AND l.tier = 'hot')::int AS hot,
      (SELECT max(created_at) FROM messe_leads l WHERE l.event_id = e.id) AS last_lead_at
    FROM messe_events e
    ORDER BY e.draw_at DESC NULLS FIRST, e.created_at DESC`;
  return rows.map((r) => ({
    ...toEvent(r),
    leads: Number(r.leads ?? 0),
    hot: Number(r.hot ?? 0),
    lastLeadAt: (r.last_lead_at as Date | null) ?? null
  }));
}

export async function getEvent(id: string): Promise<MesseEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql`SELECT * FROM messe_events WHERE id = ${id}`;
  return row ? toEvent(row) : null;
}

export async function getEventBySlug(slug: string): Promise<MesseEvent | null> {
  const [row] = await sql`SELECT * FROM messe_events WHERE slug = ${slug}`;
  return row ? toEvent(row) : null;
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = exceptId
    ? await sql`SELECT 1 FROM messe_events WHERE slug = ${slug} AND id <> ${exceptId}`
    : await sql`SELECT 1 FROM messe_events WHERE slug = ${slug}`;
  return Boolean(row);
}

export async function createEvent(input: { name: string; slug: string; createdBy: string }): Promise<string> {
  const [row] = await sql`
    INSERT INTO messe_events (name, slug, created_by)
    VALUES (${input.name}, ${input.slug}, ${input.createdBy})
    RETURNING id`;
  return String(row.id);
}

export type EventInput = Omit<MesseEvent, "id" | "createdAt" | "updatedAt">;

export async function updateEvent(id: string, e: EventInput): Promise<void> {
  await sql`
    UPDATE messe_events SET
      slug = ${e.slug}, name = ${e.name}, lang = ${e.lang}, dates_label = ${e.datesLabel}, booth = ${e.booth},
      time_zone = ${e.timeZone}, prize_title = ${e.prizeTitle}, prize_detail = ${e.prizeDetail}, draw_at = ${e.drawAt},
      demo_url = ${e.demoUrl}, terms_url = ${e.termsUrl}, privacy_url = ${e.privacyUrl}, website_url = ${e.websiteUrl},
      meta_pixel_id = ${e.metaPixelId}, google_tag_id = ${e.googleTagId}, linkedin_partner_id = ${e.linkedinPartnerId},
      ghl_tags = ${sql.array(e.ghlTags)}, active = ${e.active}, updated_at = now()
    WHERE id = ${id}`;
}

export async function deleteEvent(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await sql`DELETE FROM messe_events WHERE id = ${id}`;
}

// ── Leads ───────────────────────────────────────────────────

export async function listLeads(eventId: string): Promise<MesseLead[]> {
  const rows = await sql`SELECT * FROM messe_leads WHERE event_id = ${eventId} ORDER BY created_at DESC`;
  return rows.map(toLead);
}

export type NewLead = Omit<MesseLead, "id" | "ghlStatus" | "ghlContactId" | "ghlError" | "winnerAt" | "createdAt"> & {
  submittedAt: Date | null;
  editToken: string;
};

/**
 * Legt den Lead an oder ergänzt ihn (gleiche Losnummer). Ergänzen darf nur, wer das Token vom Anlegen kennt;
 * Kontaktangaben bleiben dabei unverändert. null: gleiche Losnummer ohne passendes Token (nichts geändert).
 * created: neu angelegt. becameComplete: mit diesem Aufruf erstmals fertig ausgefüllt (für die Meldung an Make).
 */
export async function upsertLead(l: NewLead): Promise<{ id: string; created: boolean; becameComplete: boolean } | null> {
  const [row] = await sql`
    WITH prev AS (SELECT completed FROM messe_leads WHERE event_id = ${l.eventId} AND ticket = ${l.ticket})
    INSERT INTO messe_leads (
      event_id, ticket, name, preferred_channel, whatsapp, email, units, airbnb_url, airbnb_listing_id,
      airbnb_host_id, score, tier, consent_marketing, source, utm, lang, submitted_at, edit_token, completed,
      company, pms, quiz_answer, quiz_correct
    ) VALUES (
      ${l.eventId}, ${l.ticket}, ${l.name}, ${l.preferredChannel}, ${l.whatsapp}, ${l.email}, ${l.units},
      ${l.airbnbUrl}, ${l.airbnbListingId}, ${l.airbnbHostId}, ${l.score}, ${l.tier}, ${l.consentMarketing},
      ${l.source}, ${sql.json(l.utm)}, ${l.lang}, ${l.submittedAt}, ${l.editToken}, ${l.completed},
      ${l.company}, ${l.pms}, ${l.quizAnswer}, ${l.quizCorrect}
    )
    ON CONFLICT (event_id, ticket) DO UPDATE SET
      units = EXCLUDED.units, airbnb_url = EXCLUDED.airbnb_url, airbnb_listing_id = EXCLUDED.airbnb_listing_id,
      airbnb_host_id = EXCLUDED.airbnb_host_id, score = EXCLUDED.score, tier = EXCLUDED.tier,
      company = EXCLUDED.company, pms = EXCLUDED.pms,
      consent_marketing = EXCLUDED.consent_marketing, completed = messe_leads.completed OR EXCLUDED.completed,
      updated_at = now()
    WHERE messe_leads.edit_token <> '' AND messe_leads.edit_token = EXCLUDED.edit_token
    RETURNING id, (xmax = 0) AS created, completed, COALESCE((SELECT completed FROM prev), false) AS was_completed`;
  return row
    ? { id: String(row.id), created: Boolean(row.created), becameComplete: Boolean(row.completed) && !row.was_completed }
    : null;
}

export async function getLead(id: string): Promise<MesseLead | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql`SELECT * FROM messe_leads WHERE id = ${id}`;
  return row ? toLead(row) : null;
}

export async function setGhlResult(
  id: string,
  result: { status: "ok" | "error" | "skipped"; contactId?: string | null; error?: string | null }
): Promise<void> {
  await sql`
    UPDATE messe_leads
    SET ghl_status = ${result.status}, ghl_contact_id = COALESCE(${result.contactId ?? null}, ghl_contact_id),
        ghl_error = ${result.error ?? null}
    WHERE id = ${id}`;
}

export async function leadsWithGhlErrors(eventId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return [];
  const rows = await sql`SELECT id FROM messe_leads WHERE event_id = ${eventId} AND ghl_status IN ('error', 'pending')`;
  return rows.map((r) => String(r.id));
}

/** Zieht zufällig einen Gewinner unter allen Leads mit richtiger Quizantwort (oder ohne Quiz), die noch nicht gezogen wurden. */
export async function drawWinner(eventId: string): Promise<MesseLead | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const [row] = await sql`
    UPDATE messe_leads SET winner_at = now()
    WHERE id = (
      SELECT id FROM messe_leads WHERE event_id = ${eventId} AND winner_at IS NULL AND quiz_correct IS NOT false
      ORDER BY random() LIMIT 1
    )
    RETURNING *`;
  return row ? toLead(row) : null;
}

export async function deleteLead(id: string): Promise<void> {
  await sql`DELETE FROM messe_leads WHERE id = ${id}`;
}
