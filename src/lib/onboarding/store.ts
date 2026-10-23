import { sql } from "@/lib/db";
import type { OnboardingIntent } from "./analysis";

export type DraftStatus = "draft" | "sending" | "sent" | "discarded";
export type Lang = "de" | "en";
export type Recipient = { name: string; email: string; company: string; phone: string };
export const EMPTY_RECIPIENT: Recipient = { name: "", email: "", company: "", phone: "" };

export type OrbitResult = { personId: string; mailed: boolean; partner: "assigned" | "none"; at: string };
export type GhlSyncResult = { at: string; note?: { ok: boolean; error?: string } };

export type OnboardingDraft = {
  id: string;
  status: DraftStatus;
  source: "fireflies" | "manual";
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  analysis: OnboardingIntent | null;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  recipient: Recipient;
  language: Lang;
  contractFirst: boolean;
  partnerName: string | null;
  partnerEmail: string | null;
  note: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  sentAt: string | null;
  sentByName: string | null;
  sentByEmail: string | null;
  orbitResult: OrbitResult | null;
  ghlSync: GhlSyncResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const text = (v: unknown) => (v == null ? "" : String(v));
const orNull = (v: unknown) => (v == null || v === "" ? null : String(v));

export function normalizeRecipient(r: Partial<Recipient> | null | undefined): Recipient {
  return { name: text(r?.name).trim(), email: text(r?.email).trim().toLowerCase(), company: text(r?.company).trim(), phone: text(r?.phone).trim() };
}

function toDraft(r: Row): OnboardingDraft {
  return {
    id: r.id as string,
    status: r.status as DraftStatus,
    source: r.source as OnboardingDraft["source"],
    meetingId: orNull(r.meeting_id),
    meetingTitle: orNull(r.meeting_title),
    meetingDate: iso(r.meeting_date),
    analysis: (r.analysis as OnboardingIntent) ?? null,
    ghlContactId: orNull(r.ghl_contact_id),
    ghlOpportunityId: orNull(r.ghl_opportunity_id),
    recipient: normalizeRecipient(r.recipient as Partial<Recipient>),
    language: r.language === "en" ? "en" : "de",
    contractFirst: r.contract_first === true,
    partnerName: orNull(r.partner_name),
    partnerEmail: orNull(r.partner_email),
    note: orNull(r.note),
    ownerName: orNull(r.owner_name),
    ownerEmail: orNull(r.owner_email),
    sentAt: iso(r.sent_at),
    sentByName: orNull(r.sent_by_name),
    sentByEmail: orNull(r.sent_by_email),
    orbitResult: (r.orbit_result as OrbitResult) ?? null,
    ghlSync: (r.ghl_sync as GhlSyncResult) ?? null,
    error: orNull(r.error),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!
  };
}

export type NewDraft = {
  source: OnboardingDraft["source"];
  meetingId?: string | null;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  analysis?: OnboardingIntent | null;
  ghlContactId?: string | null;
  ghlOpportunityId?: string | null;
  recipient: Recipient;
  language: Lang;
  contractFirst: boolean;
  partnerName?: string | null;
  partnerEmail?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
};

export async function createDraft(input: NewDraft, actor: string): Promise<OnboardingDraft> {
  const [row] = await sql<Row[]>`
    INSERT INTO onboarding_drafts (
      source, meeting_id, meeting_title, meeting_date, analysis, ghl_contact_id, ghl_opportunity_id,
      recipient, language, contract_first, partner_name, partner_email, owner_name, owner_email
    ) VALUES (
      ${input.source}, ${input.meetingId ?? null}, ${input.meetingTitle ?? null}, ${input.meetingDate ?? null},
      ${input.analysis ? sql.json(input.analysis as never) : null}, ${input.ghlContactId ?? null}, ${input.ghlOpportunityId ?? null},
      ${sql.json(input.recipient as never)}, ${input.language}, ${input.contractFirst},
      ${input.partnerName ?? null}, ${input.partnerEmail?.toLowerCase() ?? null}, ${input.ownerName ?? null}, ${input.ownerEmail ?? null}
    ) RETURNING *`;
  const draft = toDraft(row);
  await logEvent(draft.id, actor, "created", { source: input.source, meetingId: input.meetingId ?? null });
  return draft;
}

export async function getDraft(id: string): Promise<OnboardingDraft | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<Row[]>`SELECT * FROM onboarding_drafts WHERE id = ${id}`;
  return rows.length ? toDraft(rows[0]) : null;
}

export type DraftFilter = "open" | "sent" | "discarded";

export async function listDrafts(filter: DraftFilter, limit = 200): Promise<OnboardingDraft[]> {
  const rows =
    filter === "open"
      ? await sql<Row[]>`SELECT * FROM onboarding_drafts WHERE status IN ('draft', 'sending') ORDER BY created_at DESC LIMIT ${limit}`
      : filter === "sent"
        ? await sql<Row[]>`SELECT * FROM onboarding_drafts WHERE status = 'sent' ORDER BY sent_at DESC NULLS LAST LIMIT ${limit}`
        : await sql<Row[]>`SELECT * FROM onboarding_drafts WHERE status = 'discarded' ORDER BY updated_at DESC LIMIT ${limit}`;
  return rows.map(toDraft);
}

export async function countOpen(): Promise<number> {
  const [r] = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM onboarding_drafts WHERE status IN ('draft', 'sending')`;
  return Number(r?.n ?? 0);
}

export type DraftPatch = Partial<Pick<OnboardingDraft, "recipient" | "language" | "contractFirst" | "partnerEmail" | "partnerName" | "note">>;

/** Speichert Änderungen an einem Entwurf. Gesendete oder verworfene bleiben unverändert (Rückgabe null). */
export async function updateDraft(id: string, patch: DraftPatch): Promise<OnboardingDraft | null> {
  const current = await getDraft(id);
  if (!current || current.status !== "draft") return null;
  const next = { ...current, ...patch };
  const [row] = await sql<Row[]>`
    UPDATE onboarding_drafts SET
      recipient = ${sql.json(normalizeRecipient(next.recipient) as never)},
      language = ${next.language},
      contract_first = ${next.contractFirst},
      partner_email = ${next.partnerEmail ? next.partnerEmail.trim().toLowerCase() : null},
      partner_name = ${next.partnerName},
      note = ${next.note},
      updated_at = now()
    WHERE id = ${id} AND status = 'draft'
    RETURNING *`;
  return row ? toDraft(row) : null;
}

/** Setzt den Entwurf genau einmal auf "wird gesendet". false = schon in Arbeit, gesendet oder verworfen. */
export async function claimSend(id: string): Promise<boolean> {
  const rows = await sql`UPDATE onboarding_drafts SET status = 'sending', error = NULL, updated_at = now() WHERE id = ${id} AND status = 'draft' RETURNING id`;
  return rows.length === 1;
}

/** Das Senden ist gescheitert: zurück in den Entwurf, mit der Fehlermeldung. */
export async function releaseSend(id: string, error: string): Promise<void> {
  await sql`UPDATE onboarding_drafts SET status = 'draft', error = ${error.slice(0, 500)}, updated_at = now() WHERE id = ${id} AND status = 'sending'`;
}

export async function markSent(id: string, by: { name: string; email: string }, result: OrbitResult): Promise<void> {
  await sql`
    UPDATE onboarding_drafts SET status = 'sent', sent_at = now(), sent_by_name = ${by.name}, sent_by_email = ${by.email},
      orbit_result = ${sql.json(result as never)}, error = NULL, updated_at = now()
    WHERE id = ${id}`;
}

export async function saveGhlSync(id: string, result: GhlSyncResult): Promise<void> {
  await sql`UPDATE onboarding_drafts SET ghl_sync = ${sql.json(result as never)} WHERE id = ${id}`;
}

export async function discardDraft(id: string): Promise<boolean> {
  const rows = await sql`UPDATE onboarding_drafts SET status = 'discarded', updated_at = now() WHERE id = ${id} AND status = 'draft' RETURNING id`;
  return rows.length === 1;
}

export async function logEvent(draftId: string, actor: string | null, type: string, detail?: unknown): Promise<void> {
  await sql`INSERT INTO onboarding_events (draft_id, actor, type, detail)
    VALUES (${draftId}, ${actor}, ${type}, ${detail === undefined ? null : sql.json(detail as never)})`;
}

export type DraftEvent = { id: number; at: string; actor: string | null; type: string; detail: Record<string, unknown> | null };

export async function listEvents(draftId: string): Promise<DraftEvent[]> {
  const rows = await sql<Row[]>`SELECT * FROM onboarding_events WHERE draft_id = ${draftId} ORDER BY at DESC LIMIT 50`;
  return rows.map((r) => ({ id: Number(r.id), at: iso(r.at)!, actor: orNull(r.actor), type: r.type as string, detail: (r.detail as Record<string, unknown>) ?? null }));
}

// ── Calls von Fireflies ─────────────────────────────────────────────────

export type MeetingStatus = "processing" | "no_onboarding" | "uncertain" | "draft_created" | "internal" | "error";

export type MeetingRow = {
  meetingId: string;
  title: string | null;
  meetingDate: string | null;
  organizer: string | null;
  status: MeetingStatus;
  reason: string | null;
  draftId: string | null;
  receivedAt: string;
};

/** Registriert einen Call. false = wurde schon geprüft (Fireflies sendet Webhooks teils mehrfach). */
export async function claimMeeting(meetingId: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO onboarding_meetings (meeting_id) VALUES (${meetingId})
    ON CONFLICT (meeting_id) DO UPDATE SET status = 'processing', received_at = now()
      WHERE onboarding_meetings.status = 'error'
    RETURNING meeting_id`;
  return rows.length === 1;
}

export async function finishMeeting(
  meetingId: string,
  data: { status: MeetingStatus; title?: string | null; meetingDate?: string | null; organizer?: string | null; reason?: string | null; analysis?: OnboardingIntent | null; draftId?: string | null }
): Promise<void> {
  await sql`
    INSERT INTO onboarding_meetings (meeting_id, status, title, meeting_date, organizer, reason, analysis, draft_id, processed_at)
    VALUES (${meetingId}, ${data.status}, ${data.title ?? null}, ${data.meetingDate ?? null}, ${data.organizer ?? null},
      ${data.reason ?? null}, ${data.analysis ? sql.json(data.analysis as never) : null}, ${data.draftId ?? null}, now())
    ON CONFLICT (meeting_id) DO UPDATE SET
      status = EXCLUDED.status,
      title = COALESCE(EXCLUDED.title, onboarding_meetings.title),
      meeting_date = COALESCE(EXCLUDED.meeting_date, onboarding_meetings.meeting_date),
      organizer = COALESCE(EXCLUDED.organizer, onboarding_meetings.organizer),
      reason = EXCLUDED.reason,
      analysis = COALESCE(EXCLUDED.analysis, onboarding_meetings.analysis),
      draft_id = COALESCE(EXCLUDED.draft_id, onboarding_meetings.draft_id),
      processed_at = now()`;
}

/** Letzte geprüfte Calls, auch die ohne Entwurf, damit nachvollziehbar bleibt, warum keiner entstanden ist. */
export async function listMeetings(limit = 20): Promise<MeetingRow[]> {
  const rows = await sql<Row[]>`SELECT * FROM onboarding_meetings WHERE status <> 'internal' ORDER BY received_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    meetingId: r.meeting_id as string,
    title: orNull(r.title),
    meetingDate: iso(r.meeting_date),
    organizer: orNull(r.organizer),
    status: r.status as MeetingStatus,
    reason: orNull(r.reason),
    draftId: orNull(r.draft_id),
    receivedAt: iso(r.received_at)!
  }));
}

export async function openDraftForMeeting(meetingId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`SELECT id FROM onboarding_drafts WHERE meeting_id = ${meetingId} AND status <> 'discarded' LIMIT 1`;
  return rows[0]?.id ?? null;
}
