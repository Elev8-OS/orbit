import { sql } from "@/lib/db";
import {
  normalizeRecipient,
  normalizeTexts,
  type ContactPerson,
  type Lang,
  type QuoteConfig,
  type QuoteLine,
  type QuoteTexts,
  type Recipient
} from "./quote";
import type { CallAnalysis } from "./analysis";

export type QuoteStatus = "draft" | "sent" | "discarded";

export type GhlSyncResult = {
  at: string;
  file?: { ok: boolean; url?: string; target?: "contact_field" | "media"; error?: string };
  note?: { ok: boolean; error?: string };
  opportunity?: { ok: boolean; stage?: string; error?: string; skipped?: string };
};

export type Quote = {
  id: string;
  number: string;
  status: QuoteStatus;
  language: Lang;
  currency: string;
  source: "fireflies" | "manual";
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  analysis: CallAnalysis | null;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  ghlPipelineId: string | null;
  recipient: Recipient;
  config: QuoteConfig;
  lines: QuoteLine[];
  texts: QuoteTexts;
  validUntil: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  sentAt: string | null;
  sentByName: string | null;
  sentByEmail: string | null;
  sentFormats: string[] | null;
  sentTo: string[] | null;
  ghlSync: GhlSyncResult | null;
  /** Ansprechperson auf dem Dokument (Owner in GHL); null = Absender */
  contactPerson: ContactPerson | null;
  followUpAt: string | null;
  followUpCount: number;
  lastFollowUpAt: string | null;
  outcome: Outcome;
  outcomeAt: string | null;
  outcomeNote: string | null;
  /** Geheimer Teil des Links, über den der Kunde das Angebot annimmt (/angebot/<token>) */
  acceptToken: string;
  acceptedAt: string | null;
  acceptance: Acceptance | null;
  createdAt: string;
  updatedAt: string;
};

/** Angaben des Kunden bei der Annahme, zugleich Nachweis (Zeitpunkt, IP, Browser) */
export type Acceptance = {
  name: string;
  email: string;
  company: string;
  addressLines: string[];
  country: string;
  vatId: string;
  role: string;
  note: string;
  termsAccepted: true;
  ip: string | null;
  userAgent: string | null;
  at: string;
};

export type Outcome = "open" | "won" | "lost";

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const dateOnly = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

function toQuote(r: Row): Quote {
  return {
    id: r.id as string,
    number: r.number as string,
    status: r.status as QuoteStatus,
    language: r.language as Lang,
    currency: r.currency as string,
    source: r.source as Quote["source"],
    meetingId: (r.meeting_id as string) ?? null,
    meetingTitle: (r.meeting_title as string) ?? null,
    meetingDate: iso(r.meeting_date),
    analysis: (r.analysis as CallAnalysis) ?? null,
    ghlContactId: (r.ghl_contact_id as string) ?? null,
    ghlOpportunityId: (r.ghl_opportunity_id as string) ?? null,
    ghlPipelineId: (r.ghl_pipeline_id as string) ?? null,
    recipient: normalizeRecipient(r.recipient as Partial<Recipient>),
    config: r.config as QuoteConfig,
    lines: r.lines as QuoteLine[],
    texts: normalizeTexts(r.texts as Partial<QuoteTexts>),
    validUntil: dateOnly(r.valid_until),
    ownerId: (r.owner_id as string) ?? null,
    ownerName: (r.owner_name as string) ?? null,
    ownerEmail: (r.owner_email as string) ?? null,
    sentAt: iso(r.sent_at),
    sentByName: (r.sent_by_name as string) ?? null,
    sentByEmail: (r.sent_by_email as string) ?? null,
    sentFormats: (r.sent_formats as string[]) ?? null,
    sentTo: (r.sent_to as string[]) ?? null,
    ghlSync: (r.ghl_sync as GhlSyncResult) ?? null,
    contactPerson: (r.contact_person as ContactPerson) ?? null,
    followUpAt: r.follow_up_at ? dateOnly(r.follow_up_at) : null,
    followUpCount: Number(r.follow_up_count ?? 0),
    lastFollowUpAt: iso(r.last_follow_up_at),
    outcome: ((r.outcome as Outcome) ?? "open") as Outcome,
    outcomeAt: iso(r.outcome_at),
    outcomeNote: (r.outcome_note as string) ?? null,
    acceptToken: (r.accept_token as string) ?? "",
    acceptedAt: iso(r.accepted_at),
    acceptance: (r.acceptance as Acceptance) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!
  };
}

export async function nextQuoteNumber(prefix: string): Promise<string> {
  const [{ n }] = await sql<{ n: string }[]>`SELECT nextval('quote_number_seq')::text AS n`;
  return `${prefix}-${new Date().getUTCFullYear()}-${n.padStart(4, "0")}`;
}

export type NewQuote = {
  language: Lang;
  currency: string;
  source: Quote["source"];
  meetingId?: string | null;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  analysis?: CallAnalysis | null;
  ghlContactId?: string | null;
  ghlOpportunityId?: string | null;
  ghlPipelineId?: string | null;
  recipient: Recipient;
  config: QuoteConfig;
  lines: QuoteLine[];
  texts: QuoteTexts;
  validUntil: string;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  contactPerson?: ContactPerson | null;
};

export async function createQuote(input: NewQuote, numberPrefix: string, actor: string): Promise<Quote> {
  const number = await nextQuoteNumber(numberPrefix);
  const [row] = await sql<Row[]>`
    INSERT INTO quotes (
      number, language, currency, source, meeting_id, meeting_title, meeting_date, analysis,
      ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id, recipient, config, lines, texts, valid_until,
      owner_id, owner_name, owner_email, contact_person
    ) VALUES (
      ${number}, ${input.language}, ${input.currency}, ${input.source}, ${input.meetingId ?? null},
      ${input.meetingTitle ?? null}, ${input.meetingDate ?? null},
      ${input.analysis ? sql.json(input.analysis as never) : null},
      ${input.ghlContactId ?? null}, ${input.ghlOpportunityId ?? null}, ${input.ghlPipelineId ?? null},
      ${sql.json(input.recipient as never)}, ${sql.json(input.config as never)}, ${sql.json(input.lines as never)},
      ${sql.json(input.texts as never)}, ${input.validUntil},
      ${input.ownerId ?? null}, ${input.ownerName ?? null}, ${input.ownerEmail ?? null},
      ${input.contactPerson ? sql.json(input.contactPerson as never) : null}
    ) RETURNING *`;
  const quote = toQuote(row);
  await logEvent(quote.id, actor, "created", { source: input.source, meetingId: input.meetingId ?? null });
  return quote;
}

export async function getQuote(id: string): Promise<Quote | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<Row[]>`SELECT * FROM quotes WHERE id = ${id}`;
  return rows.length ? toQuote(rows[0]) : null;
}

export type QuoteListItem = Pick<
  Quote,
  | "id" | "number" | "status" | "recipient" | "source" | "meetingTitle" | "ownerName" | "sentAt" | "updatedAt" | "createdAt"
  | "currency" | "language" | "lines" | "ghlSync" | "followUpAt" | "followUpCount" | "lastFollowUpAt" | "outcome" | "validUntil"
  | "acceptedAt"
>;

export async function listQuotes(status: QuoteStatus | "all", limit = 200): Promise<QuoteListItem[]> {
  const rows =
    status === "all"
      ? await sql<Row[]>`SELECT * FROM quotes WHERE status <> 'discarded' ORDER BY updated_at DESC LIMIT ${limit}`
      : await sql<Row[]>`SELECT * FROM quotes WHERE status = ${status} ORDER BY updated_at DESC LIMIT ${limit}`;
  return rows.map(toQuote);
}

export type QuotePatch = Partial<
  Pick<
    Quote,
    "language" | "recipient" | "config" | "lines" | "texts" | "validUntil" | "ghlContactId" | "ghlOpportunityId" | "ghlPipelineId" | "contactPerson"
  >
>;

/** Speichert Änderungen an einem Entwurf. Versendete Offerten bleiben unverändert (Rückgabe null). */
export async function updateDraft(id: string, patch: QuotePatch): Promise<Quote | null> {
  const current = await getQuote(id);
  if (!current || current.status !== "draft") return null;
  const next = { ...current, ...patch };
  const [row] = await sql<Row[]>`
    UPDATE quotes SET
      language = ${next.language},
      recipient = ${sql.json(next.recipient as never)},
      config = ${sql.json(next.config as never)},
      lines = ${sql.json(next.lines as never)},
      texts = ${sql.json(next.texts as never)},
      valid_until = ${next.validUntil},
      ghl_contact_id = ${next.ghlContactId},
      ghl_opportunity_id = ${next.ghlOpportunityId},
      ghl_pipeline_id = ${next.ghlPipelineId},
      contact_person = ${next.contactPerson ? sql.json(next.contactPerson as never) : null},
      updated_at = now()
    WHERE id = ${id} AND status = 'draft'
    RETURNING *`;
  return row ? toQuote(row) : null;
}

/** Setzt den Entwurf genau einmal auf "versendet". Gibt false zurück, wenn er schon versendet wurde. */
export async function claimSend(id: string): Promise<boolean> {
  const rows = await sql`
    UPDATE quotes SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE id = ${id} AND status = 'draft' RETURNING id`;
  return rows.length === 1;
}

export async function releaseSend(id: string): Promise<void> {
  await sql`UPDATE quotes SET status = 'draft', sent_at = NULL WHERE id = ${id} AND status = 'sent'`;
}

export async function markSent(
  id: string,
  data: { byName: string; byEmail: string; formats: string[]; to: string[]; followUpDays: number; texts: QuoteTexts; lines: QuoteLine[] }
): Promise<void> {
  // Texte und Positionen so festhalten, wie sie verschickt wurden (inkl. aktueller Preise und Mailtext)
  await sql`
    UPDATE quotes SET sent_by_name = ${data.byName}, sent_by_email = ${data.byEmail},
      sent_formats = ${data.formats}, sent_to = ${data.to},
      texts = ${sql.json(data.texts as never)}, lines = ${sql.json(data.lines as never)},
      follow_up_at = (now() + make_interval(days => ${data.followUpDays}))::date,
      outcome = 'open', updated_at = now()
    WHERE id = ${id}`;
}

// ── Nachverfolgen ───────────────────────────────────────────

export async function listFollowUps(limit = 300): Promise<Quote[]> {
  const rows = await sql<Row[]>`
    SELECT * FROM quotes WHERE status = 'sent'
    ORDER BY (outcome = 'open') DESC, follow_up_at ASC NULLS LAST, sent_at DESC
    LIMIT ${limit}`;
  return rows.map(toQuote);
}

export async function setTracking(
  id: string,
  patch: { followUpAt?: string | null; outcome?: Outcome; outcomeNote?: string | null }
): Promise<Quote | null> {
  const current = await getQuote(id);
  if (!current || current.status !== "sent") return null;
  const outcome = patch.outcome ?? current.outcome;
  const outcomeChanged = outcome !== current.outcome;
  const [row] = await sql<Row[]>`
    UPDATE quotes SET
      follow_up_at = ${patch.followUpAt !== undefined ? patch.followUpAt : current.followUpAt},
      outcome = ${outcome},
      outcome_at = ${outcomeChanged ? (outcome === "open" ? null : new Date().toISOString()) : current.outcomeAt},
      outcome_note = ${patch.outcomeNote !== undefined ? patch.outcomeNote : current.outcomeNote},
      updated_at = now()
    WHERE id = ${id} RETURNING *`;
  return row ? toQuote(row) : null;
}

export async function recordFollowUp(id: string, nextInDays: number): Promise<void> {
  await sql`
    UPDATE quotes SET follow_up_count = follow_up_count + 1, last_follow_up_at = now(),
      follow_up_at = (now() + make_interval(days => ${nextInDays}))::date, updated_at = now()
    WHERE id = ${id}`;
}

export async function saveGhlSync(id: string, result: GhlSyncResult): Promise<void> {
  await sql`UPDATE quotes SET ghl_sync = ${sql.json(result as never)} WHERE id = ${id}`;
}

export async function setGhlLink(
  id: string,
  link: { ghlContactId: string; ghlOpportunityId: string | null; ghlPipelineId: string | null }
): Promise<void> {
  await sql`UPDATE quotes SET ghl_contact_id = ${link.ghlContactId}, ghl_opportunity_id = ${link.ghlOpportunityId},
    ghl_pipeline_id = ${link.ghlPipelineId}, updated_at = now() WHERE id = ${id}`;
}

export async function setStatus(id: string, status: QuoteStatus): Promise<void> {
  await sql`UPDATE quotes SET status = ${status}, updated_at = now() WHERE id = ${id}`;
}

export async function logEvent(quoteId: string, actor: string | null, type: string, detail?: unknown): Promise<void> {
  await sql`INSERT INTO quote_events (quote_id, actor, type, detail)
    VALUES (${quoteId}, ${actor}, ${type}, ${detail === undefined ? null : sql.json(detail as never)})`;
}

export type QuoteEvent = { id: number; at: string; actor: string | null; type: string; detail: Record<string, unknown> | null };

export async function listEvents(quoteId: string): Promise<QuoteEvent[]> {
  const rows = await sql<Row[]>`SELECT * FROM quote_events WHERE quote_id = ${quoteId} ORDER BY at DESC LIMIT 50`;
  return rows.map((r) => ({
    id: Number(r.id),
    at: iso(r.at)!,
    actor: (r.actor as string) ?? null,
    type: r.type as string,
    detail: (r.detail as Record<string, unknown>) ?? null
  }));
}

// ── Calls von Fireflies ─────────────────────────────────────

export type MeetingStatus = "processing" | "no_offer" | "uncertain" | "quote_created" | "internal" | "error" | "dismissed";

export type MeetingRow = {
  meetingId: string;
  title: string | null;
  meetingDate: string | null;
  organizer: string | null;
  status: MeetingStatus;
  reason: string | null;
  analysis: CallAnalysis | null;
  quoteId: string | null;
  receivedAt: string;
  dismissedBy: string | null;
  dismissedAt: string | null;
};

/** Registriert einen Call. false = wurde schon verarbeitet (Fireflies sendet Webhooks teils mehrfach). */
export async function claimMeeting(meetingId: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO quote_meetings (meeting_id) VALUES (${meetingId})
    ON CONFLICT (meeting_id) DO UPDATE SET status = 'processing', received_at = now()
      WHERE quote_meetings.status = 'error'
    RETURNING meeting_id`;
  return rows.length === 1;
}

export async function finishMeeting(
  meetingId: string,
  data: {
    status: MeetingStatus;
    title?: string | null;
    meetingDate?: string | null;
    organizer?: string | null;
    reason?: string | null;
    analysis?: CallAnalysis | null;
    quoteId?: string | null;
  }
): Promise<void> {
  await sql`
    INSERT INTO quote_meetings (meeting_id, status, title, meeting_date, organizer, reason, analysis, quote_id, processed_at)
    VALUES (${meetingId}, ${data.status}, ${data.title ?? null}, ${data.meetingDate ?? null}, ${data.organizer ?? null},
      ${data.reason ?? null}, ${data.analysis ? sql.json(data.analysis as never) : null}, ${data.quoteId ?? null}, now())
    ON CONFLICT (meeting_id) DO UPDATE SET
      status = EXCLUDED.status,
      title = COALESCE(EXCLUDED.title, quote_meetings.title),
      meeting_date = COALESCE(EXCLUDED.meeting_date, quote_meetings.meeting_date),
      organizer = COALESCE(EXCLUDED.organizer, quote_meetings.organizer),
      reason = EXCLUDED.reason,
      analysis = COALESCE(EXCLUDED.analysis, quote_meetings.analysis),
      quote_id = COALESCE(EXCLUDED.quote_id, quote_meetings.quote_id),
      processed_at = now()`;
}

export async function listMeetings(limit = 50): Promise<MeetingRow[]> {
  const rows = await sql<Row[]>`SELECT * FROM quote_meetings ORDER BY received_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    meetingId: r.meeting_id as string,
    title: (r.title as string) ?? null,
    meetingDate: iso(r.meeting_date),
    organizer: (r.organizer as string) ?? null,
    status: r.status as MeetingStatus,
    reason: (r.reason as string) ?? null,
    analysis: (r.analysis as CallAnalysis) ?? null,
    quoteId: (r.quote_id as string) ?? null,
    receivedAt: iso(r.received_at)!,
    dismissedBy: (r.dismissed_by as string) ?? null,
    dismissedAt: iso(r.dismissed_at)
  }));
}

/** Call von Hand als "kein Angebot nötig" markieren. Ein späterer Webhook ändert daran nichts mehr. */
export async function dismissMeeting(meetingId: string, by: string, title?: string | null): Promise<void> {
  await sql`
    INSERT INTO quote_meetings (meeting_id, status, title, dismissed_by, dismissed_at, processed_at)
    VALUES (${meetingId}, 'dismissed', ${title ?? null}, ${by}, now(), now())
    ON CONFLICT (meeting_id) DO UPDATE SET
      previous_status = CASE WHEN quote_meetings.status = 'dismissed' THEN quote_meetings.previous_status ELSE quote_meetings.status END,
      status = 'dismissed', dismissed_by = ${by}, dismissed_at = now()`;
}

export async function restoreMeeting(meetingId: string): Promise<void> {
  await sql`
    UPDATE quote_meetings SET status = COALESCE(previous_status, 'no_offer'), dismissed_by = NULL, dismissed_at = NULL
    WHERE meeting_id = ${meetingId} AND status = 'dismissed'`;
  // Ohne vorherigen Status (nie automatisch verarbeitet): Eintrag entfernen, damit er wieder offen erscheint
  await sql`DELETE FROM quote_meetings WHERE meeting_id = ${meetingId} AND status = 'no_offer' AND processed_at IS NOT NULL
    AND analysis IS NULL AND quote_id IS NULL AND reason IS NULL`;
}

export async function openQuoteForMeeting(meetingId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM quotes WHERE meeting_id = ${meetingId} AND status <> 'discarded' LIMIT 1`;
  return rows[0]?.id ?? null;
}

// ── Annahme durch den Kunden ──────────────────────────────────────────────

export async function getQuoteByAcceptToken(token: string): Promise<Quote | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const rows = await sql<Row[]>`SELECT * FROM quotes WHERE accept_token = ${token}`;
  return rows.length ? toQuote(rows[0]) : null;
}

/**
 * Setzt die Offerte genau einmal auf angenommen (gewonnen). Gibt null zurück, wenn sie nicht mehr offen ist
 * (bereits angenommen, verloren, verworfen) – so kann ein Doppelklick nichts doppelt auslösen.
 */
export async function markAccepted(token: string, acceptance: Acceptance): Promise<Quote | null> {
  const [row] = await sql<Row[]>`
    UPDATE quotes SET
      accepted_at = now(),
      acceptance = ${sql.json(acceptance as never)},
      outcome = 'won',
      outcome_at = now(),
      outcome_note = ${"Online angenommen von " + acceptance.name},
      follow_up_at = NULL,
      updated_at = now()
    WHERE accept_token = ${token} AND status = 'sent' AND outcome = 'open' AND accepted_at IS NULL
    RETURNING *`;
  return row ? toQuote(row) : null;
}
