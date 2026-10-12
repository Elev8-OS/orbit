import { sql } from "@/lib/db";
import type { CallAnalysis } from "@/lib/offerten/analysis";
import { firefliesConfigured, getTranscript, transcriptText } from "@/lib/offerten/fireflies";
import type { SalesUser } from "./access";
import { proposeFollowUp, suggestionSchema, suggestionsConfigured, type FollowUpSuggestion } from "./claude";
import * as ghl from "./ghl";

// ── Zeit ────────────────────────────────────────────────────

/** Standard-Zeitzone für „heute“, solange der Browser seine noch nicht gemeldet hat. Über SALES_TIMEZONE änderbar. */
export const salesTimeZone = () => process.env.SALES_TIMEZONE || "Europe/Zurich";

export function validTimeZone(tz: string | null | undefined): string {
  if (!tz) return salesTimeZone();
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return salesTimeZone();
  }
}
export const staleDays = () => Math.max(1, Number(process.env.SALES_STALE_DAYS) || 14);

function localParts(t: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Beginn des Tages (lokal in tz) als Zeitpunkt, offsetDays = 0 heute, 1 morgen … */
export function startOfLocalDay(offsetDays = 0, tz = salesTimeZone(), now = Date.now()): Date {
  const p = localParts(now, tz);
  const guess = Date.UTC(p.y, p.m - 1, p.d + offsetDays);
  const lp = localParts(guess, tz);
  const offset = Date.UTC(lp.y, lp.m - 1, lp.d, lp.h, lp.min, lp.s) - guess;
  return new Date(guess - offset);
}

export function localDate(offsetDays = 0, tz = salesTimeZone()): string {
  const p = localParts(Date.now() + offsetDays * 86_400_000, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Fälligkeit für GHL: Datum als 09:00 Uhr lokal. */
export function dueDateIso(date: string, tz = salesTimeZone()): string {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 9);
  const lp = localParts(guess, tz);
  const offset = Date.UTC(lp.y, lp.m - 1, lp.d, lp.h, lp.min, lp.s) - guess;
  return new Date(guess - offset).toISOString();
}

async function limit<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

// ── Wer wird angezeigt? ─────────────────────────────────────

export type Viewer = {
  user: SalesUser;
  ghlUser: ghl.GhlUser;
  /** true, wenn ein Manager die Ansicht eines anderen öffnet */
  other: boolean;
};

export type ViewerResult = { ok: true; viewer: Viewer } | { ok: false; reason: "ghl_not_configured" | "no_ghl_user"; email: string };

/**
 * Ordnet den angemeldeten User über die E-Mail einem GHL-User zu. Manager können mit `asUserId`
 * die Ansicht eines anderen GHL-Users öffnen. Alle Daten werden danach nur für diesen GHL-User geladen.
 */
export async function resolveViewer(user: SalesUser, asUserId?: string | null): Promise<ViewerResult> {
  if (!ghl.ghlConfigured()) return { ok: false, reason: "ghl_not_configured", email: user.email };
  if (asUserId && user.isManager) {
    const target = (await ghl.listUsers()).find((u) => u.id === asUserId);
    if (target) return { ok: true, viewer: { user, ghlUser: target, other: target.email !== user.email } };
  }
  const own = await ghl.userByEmail(user.email);
  if (!own) return { ok: false, reason: "no_ghl_user", email: user.email };
  return { ok: true, viewer: { user, ghlUser: own, other: false } };
}

/** Darf der Viewer an diesem Kontakt arbeiten? Manager immer, sonst nur eigene Kontakte. */
export async function canUseContact(viewer: Viewer, contactId: string): Promise<boolean> {
  if (viewer.user.isManager) return true;
  const contact = await ghl.getContact(contactId, true);
  if (!contact) return false;
  if (contact.assignedTo === viewer.ghlUser.id) return true;
  const opps = await ghl.opportunitiesForContact(contactId);
  if (opps.some((o) => o.assignedTo === viewer.ghlUser.id)) return true;
  const calls = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM quote_meetings
    WHERE lower(organizer) = ${viewer.ghlUser.email} AND lower(analysis->>'contactEmail') = ${contact.email}`;
  return contact.email !== "" && (calls[0]?.n ?? 0) > 0;
}

// ── Calls ohne nächsten Schritt ─────────────────────────────

export type OpenCall = {
  meetingId: string;
  title: string;
  date: string | null;
  summary: string;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactId: string | null;
  language: "de" | "en";
};

type MeetingRecord = {
  meeting_id: string;
  title: string | null;
  meeting_date: Date | null;
  received_at: Date;
  organizer: string | null;
  analysis: CallAnalysis | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

async function meetingRecord(meetingId: string): Promise<MeetingRecord | null> {
  const rows = await sql<MeetingRecord[]>`
    SELECT meeting_id, title, meeting_date, received_at, organizer, analysis FROM quote_meetings WHERE meeting_id = ${meetingId}`;
  return rows[0] ?? null;
}

/**
 * Gespräche der letzten 21 Tage ohne nächsten Schritt: kein Offertwunsch erkannt oder als „kein Angebot nötig“ markiert (dann wäre die Offerte der
 * nächste Schritt), in Orbit nicht abgehakt, und in GHL weder ein Task nach dem Call noch ein künftiger Termin.
 */
export async function callsWithoutNextStep(viewer: Viewer): Promise<OpenCall[]> {
  const rows = await sql<MeetingRecord[]>`
    SELECT m.meeting_id, m.title, m.meeting_date, m.received_at, m.organizer, m.analysis
    FROM quote_meetings m
    LEFT JOIN sales_call_marks k ON k.meeting_id = m.meeting_id
    WHERE k.meeting_id IS NULL
      -- 'dismissed' = in den Offerten als „kein Angebot nötig“ markiert; ein Follow-up braucht es trotzdem
      AND m.status IN ('no_offer', 'uncertain', 'dismissed')
      AND m.quote_id IS NULL
      AND lower(m.organizer) = ${viewer.ghlUser.email}
      AND COALESCE(m.meeting_date, m.received_at) > now() - interval '21 days'
    ORDER BY COALESCE(m.meeting_date, m.received_at) DESC
    LIMIT 20`;

  const now = Date.now();
  const checked = await limit(rows, 4, async (r): Promise<OpenCall | null> => {
    const a = r.analysis;
    const callDate = iso(r.meeting_date) ?? iso(r.received_at);
    let contact: ghl.SalesContact | null = null;
    if (a?.contactEmail) contact = await ghl.findContactByEmail(a.contactEmail).catch(() => null);
    if (contact) {
      const [tasks, events] = await Promise.all([
        ghl.tasksForContact(contact.id).catch(() => [] as ghl.GhlTask[]),
        ghl.eventsForContact(contact.id).catch(() => [] as ghl.GhlEvent[])
      ]);
      const after = callDate ?? "";
      const hasTask = tasks.some((t) => !t.completed || (t.dueDate ?? "") >= after);
      const hasMeeting = events.some((e) => Date.parse(e.start) > now);
      if (hasTask || hasMeeting) return null;
    }
    return {
      meetingId: r.meeting_id,
      title: r.title ?? "",
      date: callDate,
      summary: a?.summary ?? "",
      company: a?.company || contact?.company || null,
      contactName: a?.contactName || contact?.name || null,
      contactEmail: a?.contactEmail ?? null,
      contactId: contact?.id ?? null,
      language: a?.language === "en" ? "en" : "de"
    };
  });
  return checked.filter((c): c is OpenCall => c !== null);
}

export async function markCall(
  meetingId: string,
  state: "followup_set" | "dismissed",
  by: string,
  extra: { taskId?: string | null; contactId?: string | null } = {}
) {
  await sql`
    INSERT INTO sales_call_marks (meeting_id, state, ghl_task_id, ghl_contact_id, by_email)
    VALUES (${meetingId}, ${state}, ${extra.taskId ?? null}, ${extra.contactId ?? null}, ${by})
    ON CONFLICT (meeting_id) DO UPDATE SET state = EXCLUDED.state, ghl_task_id = EXCLUDED.ghl_task_id,
      ghl_contact_id = EXCLUDED.ghl_contact_id, by_email = EXCLUDED.by_email, at = now()`;
}

export async function unmarkCall(meetingId: string) {
  await sql`DELETE FROM sales_call_marks WHERE meeting_id = ${meetingId}`;
}

/** Gehört der Call dem Viewer (oder ist der Viewer Manager)? */
export async function canUseCall(viewer: Viewer, meetingId: string): Promise<MeetingRecord | null> {
  const record = await meetingRecord(meetingId);
  if (!record) return null;
  if (viewer.user.isManager || (record.organizer ?? "").toLowerCase() === viewer.ghlUser.email) return record;
  return null;
}

/** Follow-up-Vorschlag von Claude, pro Call einmal erzeugt und danach aus der Datenbank. */
export async function suggestionFor(meetingId: string, refresh = false, tz = salesTimeZone()): Promise<FollowUpSuggestion> {
  if (!refresh) {
    const cached = await sql<{ suggestion: unknown }[]>`SELECT suggestion FROM sales_suggestions WHERE meeting_id = ${meetingId}`;
    const parsed = suggestionSchema.safeParse(cached[0]?.suggestion);
    if (parsed.success) return parsed.data;
  }
  const record = await meetingRecord(meetingId);
  if (!record) throw new Error("meeting_not_found");
  if (!suggestionsConfigured()) throw new Error("claude_not_configured");
  const a = record.analysis;
  const transcript = firefliesConfigured() ? await getTranscript(meetingId).catch(() => null) : null;
  const suggestion = await proposeFollowUp({
    language: a?.language === "en" ? "en" : "de",
    today: localDate(0, tz),
    callDate: iso(record.meeting_date)?.slice(0, 10) ?? null,
    title: record.title ?? "",
    company: a?.company ?? null,
    contactName: a?.contactName ?? null,
    summary: transcript?.summary.overview || transcript?.summary.shortSummary || a?.summary || "",
    actionItems: [a?.nextStep ? `Vereinbarter nächster Schritt laut Analyse: ${a.nextStep}` : "", transcript?.summary.actionItems ?? ""]
      .filter(Boolean)
      .join("\n"),
    transcript: transcript ? transcriptText(transcript, 40_000) : ""
  });
  await sql`
    INSERT INTO sales_suggestions (meeting_id, suggestion) VALUES (${meetingId}, ${sql.json(suggestion as never)})
    ON CONFLICT (meeting_id) DO UPDATE SET suggestion = EXCLUDED.suggestion, created_at = now()`;
  return suggestion;
}

// ── Heute ───────────────────────────────────────────────────

export type TodayEvent = ghl.GhlEvent & { contactName: string; company: string; day: "today" | "tomorrow" };
export type TodayTask = ghl.GhlTask & { bucket: "overdue" | "today" | "soon" };

export type TodayData = {
  events: TodayEvent[];
  tasks: TodayTask[];
  calls: OpenCall[];
  pipeline: { open: number; value: number; stale: number };
  errors: string[];
};

export async function loadToday(viewer: Viewer, tz = salesTimeZone()): Promise<TodayData> {
  const errors: string[] = [];
  const soft = <T,>(label: string, p: Promise<T>, fallback: T) =>
    p.catch((err) => {
      console.error(`Sales: ${label}:`, err);
      errors.push(label);
      return fallback;
    });

  const todayStart = startOfLocalDay(0, tz);
  const tomorrowStart = startOfLocalDay(1, tz);
  const dayAfter = startOfLocalDay(2, tz);
  const soonEnd = startOfLocalDay(8, tz);

  const [events, tasks, opps, calls] = await Promise.all([
    soft("calendar", ghl.eventsForUser(viewer.ghlUser.id, todayStart, dayAfter), [] as ghl.GhlEvent[]),
    soft("tasks", ghl.openTasksForUser(viewer.ghlUser.id), [] as ghl.GhlTask[]),
    soft("opportunities", ghl.openOpportunitiesForUser(viewer.ghlUser.id), [] as ghl.SalesOpportunity[]),
    soft("calls", callsWithoutNextStep(viewer), [] as OpenCall[])
  ]);

  const enriched = await limit(events, 5, async (e): Promise<TodayEvent> => {
    const c = e.contactId ? await ghl.getContact(e.contactId).catch(() => null) : null;
    return {
      ...e,
      contactName: c?.name ?? "",
      company: c?.company ?? "",
      day: Date.parse(e.start) < tomorrowStart.getTime() ? "today" : "tomorrow"
    };
  });

  const bucketed = tasks
    .map((t): TodayTask | null => {
      const due = t.dueDate ? Date.parse(t.dueDate) : NaN;
      if (Number.isNaN(due)) return { ...t, bucket: "soon" };
      if (due < todayStart.getTime()) return { ...t, bucket: "overdue" };
      if (due < tomorrowStart.getTime()) return { ...t, bucket: "today" };
      if (due < soonEnd.getTime()) return { ...t, bucket: "soon" };
      return null;
    })
    .filter((t): t is TodayTask => t !== null)
    .sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));

  // Namen nachladen, wenn die Task-Suche keine Kontaktdetails mitliefert
  await limit(
    bucketed.filter((t) => !t.contactName && t.contactId),
    5,
    async (t) => {
      const c = await ghl.getContact(t.contactId).catch(() => null);
      t.contactName = c ? c.name || c.company || c.email : "";
    }
  );

  const staleBefore = Date.now() - staleDays() * 86_400_000;
  return {
    events: enriched,
    tasks: bucketed,
    calls,
    pipeline: {
      open: opps.length,
      value: opps.reduce((s, o) => s + (o.value ?? 0), 0),
      stale: opps.filter((o) => o.lastActivity && Date.parse(o.lastActivity) < staleBefore).length
    },
    errors
  };
}

// ── Pipeline ────────────────────────────────────────────────

export type PipelineView = {
  pipelines: { id: string; name: string; count: number }[];
  active: { id: string; name: string; stages: { id: string; name: string; deals: (ghl.SalesOpportunity & { stale: boolean })[] }[] } | null;
};

export async function loadPipeline(viewer: Viewer, pipelineId?: string | null): Promise<PipelineView> {
  const [pipelines, opps] = await Promise.all([ghl.listPipelines(), ghl.openOpportunitiesForUser(viewer.ghlUser.id)]);
  const counts = new Map<string, number>();
  for (const o of opps) counts.set(o.pipelineId, (counts.get(o.pipelineId) ?? 0) + 1);
  const withDeals = pipelines.filter((p) => counts.has(p.id));
  const list = (withDeals.length ? withDeals : pipelines).map((p) => ({ id: p.id, name: p.name, count: counts.get(p.id) ?? 0 }));
  const chosen = pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.id === list[0]?.id) ?? null;
  if (!chosen) return { pipelines: list, active: null };
  const staleBefore = Date.now() - staleDays() * 86_400_000;
  return {
    pipelines: list,
    active: {
      id: chosen.id,
      name: chosen.name,
      stages: chosen.stages.map((s) => ({
        id: s.id,
        name: s.name,
        deals: opps
          .filter((o) => o.pipelineId === chosen.id && o.stageId === s.id)
          .map((o) => ({ ...o, stale: Boolean(o.lastActivity && Date.parse(o.lastActivity) < staleBefore) }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      }))
    }
  };
}

// ── Kontakt ─────────────────────────────────────────────────

export type ContactCall = { meetingId: string; title: string; date: string | null; summary: string; quoteId: string | null };
export type ContactQuote = { id: string; number: string; status: string; sentAt: string | null; updatedAt: string };

export type ContactView = {
  contact: ghl.SalesContact;
  url: string;
  opportunities: (ghl.SalesOpportunity & { pipelineName: string; stageName: string })[];
  stages: Record<string, { id: string; name: string }[]>;
  tasks: ghl.GhlTask[];
  events: ghl.GhlEvent[];
  notes: ghl.GhlNote[];
  calls: ContactCall[];
  quotes: ContactQuote[];
};

export async function loadContact(contactId: string): Promise<ContactView | null> {
  const contact = await ghl.getContact(contactId, true);
  if (!contact) return null;
  const [opps, pipelines, tasks, events, notes, calls, quotes] = await Promise.all([
    ghl.opportunitiesForContact(contactId).catch(() => []),
    ghl.listPipelines().catch(() => []),
    ghl.tasksForContact(contactId).catch(() => []),
    ghl.eventsForContact(contactId).catch(() => []),
    ghl.notesForContact(contactId).catch(() => []),
    contact.email
      ? sql<{ meeting_id: string; title: string | null; meeting_date: Date | null; received_at: Date; analysis: CallAnalysis | null; quote_id: string | null }[]>`
          SELECT meeting_id, title, meeting_date, received_at, analysis, quote_id FROM quote_meetings
          WHERE lower(analysis->>'contactEmail') = ${contact.email}
          ORDER BY COALESCE(meeting_date, received_at) DESC LIMIT 10`
      : Promise.resolve([]),
    sql<{ id: string; number: string; status: string; sent_at: Date | null; updated_at: Date }[]>`
      SELECT id, number, status, sent_at, updated_at FROM quotes
      WHERE ghl_contact_id = ${contactId} AND status <> 'discarded' ORDER BY updated_at DESC LIMIT 10`
  ]);
  const stages: ContactView["stages"] = Object.fromEntries(pipelines.map((p) => [p.id, p.stages]));
  return {
    contact,
    url: ghl.contactUrl(contactId),
    opportunities: opps.map((o) => {
      const p = pipelines.find((x) => x.id === o.pipelineId);
      return { ...o, pipelineName: p?.name ?? "", stageName: p?.stages.find((s) => s.id === o.stageId)?.name ?? "" };
    }),
    stages,
    tasks: tasks.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    events,
    notes: notes.slice(0, 15),
    calls: calls.map((c) => ({
      meetingId: c.meeting_id,
      title: c.title ?? "",
      date: iso(c.meeting_date) ?? iso(c.received_at),
      summary: c.analysis?.summary ?? "",
      quoteId: c.quote_id
    })),
    quotes: quotes.map((q) => ({ id: q.id, number: q.number, status: q.status, sentAt: iso(q.sent_at), updatedAt: iso(q.updated_at)! }))
  };
}
