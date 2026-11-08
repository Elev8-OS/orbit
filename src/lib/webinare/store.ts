import { sql } from "@/lib/db";

export type Segment = { start: number; end: number; speaker: string; de: string; en: string };
export type Chapter = { start: number; de: string; en: string };
export type Bilingual = { de: string[]; en: string[] };

export type Webinar = {
  id: string;
  slug: string;
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  speaker: string;
  startsAt: Date;
  durationMin: number;
  published: boolean;
  ghlTagBase: string;
  teamsWebinarId: string | null;
  teamsJoinUrl: string | null;
  attendanceFinalizedAt: Date | null;
  attendanceNote: string | null;
  bunnyVideoDe: string | null;
  bunnyVideoEn: string | null;
  firefliesId: string | null;
  transcript: Segment[];
  transcriptOffsetSec: number;
  chapters: Chapter[];
  summaryDe: string;
  summaryEn: string;
  takeaways: Bilingual;
  checklist: Bilingual;
  teaserStartSec: number | null;
  teaserEndSec: number | null;
  recordingPublishedAt: Date | null;
  dubbingId: string | null;
  dubbingStatus: string | null;
};

export type Registration = {
  id: string;
  webinarId: string;
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  pms: string;
  units: string;
  newsletter: boolean;
  lang: string;
  status: "registered" | "attended" | "missed";
  attendedSeconds: number | null;
  joinClickedAt: Date | null;
  teamsRegistrationId: string | null;
  ghlContactId: string | null;
  ghlStatus: string | null;
  ghlError: string | null;
  source: string;
  createdAt: Date;
};

type Row = Record<string, unknown>;

function toWebinar(r: Row): Webinar {
  return {
    id: r.id as string,
    slug: r.slug as string,
    titleDe: r.title_de as string,
    titleEn: r.title_en as string,
    descriptionDe: r.description_de as string,
    descriptionEn: r.description_en as string,
    speaker: r.speaker as string,
    startsAt: r.starts_at as Date,
    durationMin: r.duration_min as number,
    published: r.published as boolean,
    ghlTagBase: r.ghl_tag_base as string,
    teamsWebinarId: (r.teams_webinar_id as string) ?? null,
    teamsJoinUrl: (r.teams_join_url as string) ?? null,
    attendanceFinalizedAt: (r.attendance_finalized_at as Date) ?? null,
    attendanceNote: (r.attendance_note as string) ?? null,
    bunnyVideoDe: (r.bunny_video_de as string) ?? null,
    bunnyVideoEn: (r.bunny_video_en as string) ?? null,
    firefliesId: (r.fireflies_id as string) ?? null,
    transcript: (r.transcript as Segment[]) ?? [],
    transcriptOffsetSec: Number(r.transcript_offset_sec ?? 0),
    chapters: (r.chapters as Chapter[]) ?? [],
    summaryDe: r.summary_de as string,
    summaryEn: r.summary_en as string,
    takeaways: (r.takeaways as Bilingual) ?? { de: [], en: [] },
    checklist: (r.checklist as Bilingual) ?? { de: [], en: [] },
    teaserStartSec: (r.teaser_start_sec as number) ?? null,
    teaserEndSec: (r.teaser_end_sec as number) ?? null,
    recordingPublishedAt: (r.recording_published_at as Date) ?? null,
    dubbingId: (r.dubbing_id as string) ?? null,
    dubbingStatus: (r.dubbing_status as string) ?? null
  };
}

function toRegistration(r: Row): Registration {
  return {
    id: r.id as string,
    webinarId: r.webinar_id as string,
    email: r.email as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    organization: r.organization as string,
    pms: r.pms as string,
    units: r.units as string,
    newsletter: r.newsletter as boolean,
    lang: r.lang as string,
    status: r.status as Registration["status"],
    attendedSeconds: (r.attended_seconds as number) ?? null,
    joinClickedAt: (r.join_clicked_at as Date) ?? null,
    teamsRegistrationId: (r.teams_registration_id as string) ?? null,
    ghlContactId: (r.ghl_contact_id as string) ?? null,
    ghlStatus: (r.ghl_status as string) ?? null,
    ghlError: (r.ghl_error as string) ?? null,
    source: r.source as string,
    createdAt: r.created_at as Date
  };
}

export type WebinarListItem = Webinar & { registered: number; attended: number; openQuestions: number };

export async function listWebinars(): Promise<WebinarListItem[]> {
  const rows = await sql`
    SELECT w.*,
      (SELECT count(*)::int FROM webinar_registrations r WHERE r.webinar_id = w.id) AS registered,
      (SELECT count(*)::int FROM webinar_registrations r WHERE r.webinar_id = w.id AND r.status = 'attended') AS attended,
      (SELECT count(*)::int FROM webinar_questions q WHERE q.webinar_id = w.id AND q.status = 'open') AS open_questions
    FROM webinar_webinars w ORDER BY w.starts_at DESC`;
  return rows.map((r) => ({ ...toWebinar(r), registered: r.registered, attended: r.attended, openQuestions: r.open_questions }));
}

export async function getWebinar(id: string): Promise<Webinar | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql`SELECT * FROM webinar_webinars WHERE id = ${id}`;
  return r ? toWebinar(r) : null;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function createWebinar(input: { titleDe: string; startsAt: Date; slug?: string; tagTopic?: string }): Promise<string> {
  const day = input.startsAt.toISOString().slice(0, 10);
  const topic = slugify(input.tagTopic || input.titleDe).split("-").slice(0, 3).join("-") || "webinar";
  const slug = slugify(input.slug || `${day}-${input.titleDe}`);
  const [r] = await sql`
    INSERT INTO webinar_webinars (slug, title_de, starts_at, ghl_tag_base)
    VALUES (${slug}, ${input.titleDe}, ${input.startsAt}, ${`webinar-${day}-${topic}`})
    RETURNING id`;
  return r.id as string;
}

const COLUMNS: Record<string, string> = {
  titleDe: "title_de",
  titleEn: "title_en",
  descriptionDe: "description_de",
  descriptionEn: "description_en",
  speaker: "speaker",
  startsAt: "starts_at",
  durationMin: "duration_min",
  published: "published",
  ghlTagBase: "ghl_tag_base",
  slug: "slug",
  teamsWebinarId: "teams_webinar_id",
  teamsJoinUrl: "teams_join_url",
  bunnyVideoDe: "bunny_video_de",
  bunnyVideoEn: "bunny_video_en",
  firefliesId: "fireflies_id",
  transcript: "transcript",
  transcriptOffsetSec: "transcript_offset_sec",
  chapters: "chapters",
  summaryDe: "summary_de",
  summaryEn: "summary_en",
  takeaways: "takeaways",
  checklist: "checklist",
  teaserStartSec: "teaser_start_sec",
  teaserEndSec: "teaser_end_sec",
  recordingPublishedAt: "recording_published_at",
  attendanceFinalizedAt: "attendance_finalized_at",
  attendanceNote: "attendance_note",
  dubbingId: "dubbing_id",
  dubbingStatus: "dubbing_status"
};
const JSON_COLS = new Set(["transcript", "chapters", "takeaways", "checklist"]);

export async function updateWebinar(id: string, patch: Partial<Webinar>): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = COLUMNS[key];
    if (!col || value === undefined) continue;
    data[col] = JSON_COLS.has(col) ? sql.json(value as never) : value;
  }
  if (!Object.keys(data).length) return;
  data.updated_at = new Date();
  await sql`UPDATE webinar_webinars SET ${sql(data)} WHERE id = ${id}`;
}

export async function deleteWebinar(id: string): Promise<void> {
  await sql`DELETE FROM webinar_webinars WHERE id = ${id}`;
}

export async function listRegistrations(webinarId: string): Promise<Registration[]> {
  const rows = await sql`SELECT * FROM webinar_registrations WHERE webinar_id = ${webinarId} ORDER BY last_name, first_name, email`;
  return rows.map(toRegistration);
}

export async function setRegistrationStatus(webinarId: string, ids: string[], status: Registration["status"]): Promise<void> {
  if (!ids.length) return;
  await sql`UPDATE webinar_registrations SET status = ${status} WHERE webinar_id = ${webinarId} AND id = ANY(${ids})`;
}

export async function setRegistrationGhl(id: string, r: { contactId?: string | null; status: string; error?: string | null }) {
  await sql`UPDATE webinar_registrations SET ghl_contact_id = COALESCE(${r.contactId ?? null}, ghl_contact_id),
    ghl_status = ${r.status}, ghl_error = ${r.error ?? null} WHERE id = ${id}`;
}

export type ImportRow = {
  email: string;
  firstName: string;
  lastName: string;
  organization?: string;
  pms?: string;
  units?: string;
  newsletter?: boolean;
  attendedSeconds?: number | null;
  status?: Registration["status"];
  registeredAt?: Date | null;
};

/** Anmeldungen einfügen oder ergänzen (z. B. aus dem Teams-Bericht). Bestehende Angaben aus dem Portal bleiben erhalten. */
export async function upsertRegistrations(webinarId: string, rows: ImportRow[], source: string): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email.includes("@")) continue;
    await sql`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, organization, pms, units, newsletter, status, attended_seconds, source, created_at)
      VALUES (${webinarId}, ${email}, ${row.firstName}, ${row.lastName}, ${row.organization ?? ""}, ${row.pms ?? ""}, ${row.units ?? ""},
        ${row.newsletter ?? false}, ${row.status ?? "registered"}, ${row.attendedSeconds ?? null}, ${source}, ${row.registeredAt ?? new Date()})
      ON CONFLICT (webinar_id, email) DO UPDATE SET
        first_name = CASE WHEN webinar_registrations.first_name = '' THEN EXCLUDED.first_name ELSE webinar_registrations.first_name END,
        last_name = CASE WHEN webinar_registrations.last_name = '' THEN EXCLUDED.last_name ELSE webinar_registrations.last_name END,
        organization = CASE WHEN webinar_registrations.organization = '' THEN EXCLUDED.organization ELSE webinar_registrations.organization END,
        pms = CASE WHEN webinar_registrations.pms = '' THEN EXCLUDED.pms ELSE webinar_registrations.pms END,
        units = CASE WHEN webinar_registrations.units = '' THEN EXCLUDED.units ELSE webinar_registrations.units END,
        newsletter = webinar_registrations.newsletter OR EXCLUDED.newsletter,
        status = EXCLUDED.status,
        attended_seconds = EXCLUDED.attended_seconds`;
    await sql`INSERT INTO webinar_people (email, first_name, last_name) VALUES (${email}, ${row.firstName}, ${row.lastName})
      ON CONFLICT (email) DO NOTHING`;
    n++;
  }
  return n;
}

export async function markLiveEver(emails: string[]): Promise<void> {
  if (!emails.length) return;
  await sql`UPDATE webinar_people SET live_ever = TRUE WHERE email = ANY(${emails})`;
}

/* ── Fragen ──────────────────────────────────────────────── */

export type Question = { id: string; webinarId: string; email: string; name: string; body: string; status: string; answerAtSec: number | null; createdAt: Date };

export async function listQuestions(webinarId: string): Promise<Question[]> {
  const rows = await sql`SELECT * FROM webinar_questions WHERE webinar_id = ${webinarId} ORDER BY status = 'open' DESC, sort_order, created_at`;
  return rows.map((r) => ({
    id: r.id,
    webinarId: r.webinar_id,
    email: r.email,
    name: r.name,
    body: r.body,
    status: r.status,
    answerAtSec: r.answer_at_sec ?? null,
    createdAt: r.created_at
  }));
}

export async function updateQuestion(id: string, status: string, answerAtSec: number | null): Promise<void> {
  await sql`UPDATE webinar_questions SET status = ${status}, answer_at_sec = ${answerAtSec} WHERE id = ${id}`;
}

/* ── Abstimmungen ────────────────────────────────────────── */

export type PollOption = { id: string; labelDe: string; labelEn: string; startsAt: Date | null; status: string; suggestedBy: string | null; votes: number };
export type Poll = {
  id: string;
  slug: string;
  kind: "topic" | "date";
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  status: "draft" | "open" | "closed";
  allowSuggestions: boolean;
  showResults: boolean;
  createdAt: Date;
  options: PollOption[];
  voters: number;
  contacts: number;
};

export async function listPolls(): Promise<Poll[]> {
  const polls = await sql`SELECT p.*,
      (SELECT count(DISTINCT device_id)::int FROM webinar_poll_votes v WHERE v.poll_id = p.id) AS voters,
      (SELECT count(*)::int FROM webinar_poll_contacts c WHERE c.poll_id = p.id) AS contacts
    FROM webinar_polls p ORDER BY p.created_at DESC`;
  const options = await sql`SELECT o.*, (SELECT count(*)::int FROM webinar_poll_votes v WHERE v.option_id = o.id) AS votes
    FROM webinar_poll_options o ORDER BY o.sort_order, o.starts_at NULLS LAST, o.created_at`;
  return polls.map((p) => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    titleDe: p.title_de,
    titleEn: p.title_en,
    descriptionDe: p.description_de,
    descriptionEn: p.description_en,
    status: p.status,
    allowSuggestions: p.allow_suggestions,
    showResults: p.show_results,
    createdAt: p.created_at,
    voters: p.voters,
    contacts: p.contacts,
    options: options
      .filter((o) => o.poll_id === p.id)
      .map((o) => ({ id: o.id, labelDe: o.label_de, labelEn: o.label_en, startsAt: o.starts_at ?? null, status: o.status, suggestedBy: o.suggested_by ?? null, votes: o.votes }))
  }));
}

export async function createPoll(input: {
  kind: "topic" | "date";
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  allowSuggestions: boolean;
  showResults: boolean;
  createdBy: string;
  options: { labelDe: string; labelEn: string; startsAt: Date | null }[];
}): Promise<string> {
  const base = slugify(input.titleDe) || "umfrage";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const [p] = await sql`INSERT INTO webinar_polls (slug, kind, title_de, title_en, description_de, description_en, allow_suggestions, show_results, created_by)
    VALUES (${slug}, ${input.kind}, ${input.titleDe}, ${input.titleEn}, ${input.descriptionDe}, ${input.descriptionEn},
      ${input.kind === "topic" && input.allowSuggestions}, ${input.showResults}, ${input.createdBy}) RETURNING id`;
  let i = 0;
  for (const o of input.options) {
    await sql`INSERT INTO webinar_poll_options (poll_id, label_de, label_en, starts_at, sort_order) VALUES (${p.id}, ${o.labelDe}, ${o.labelEn}, ${o.startsAt}, ${i++})`;
  }
  return p.id as string;
}

export async function setPollStatus(id: string, status: "open" | "closed"): Promise<void> {
  await sql`UPDATE webinar_polls SET status = ${status}, closed_at = ${status === "closed" ? new Date() : null} WHERE id = ${id}`;
}

export async function setOptionStatus(id: string, status: "active" | "rejected", labelEn?: string): Promise<void> {
  if (labelEn !== undefined) await sql`UPDATE webinar_poll_options SET status = ${status}, label_en = ${labelEn} WHERE id = ${id}`;
  else await sql`UPDATE webinar_poll_options SET status = ${status} WHERE id = ${id}`;
}

export async function pollContacts(pollId: string, optionId?: string): Promise<{ email: string; lang: string }[]> {
  const rows = optionId
    ? await sql`SELECT c.email, c.lang FROM webinar_poll_contacts c JOIN webinar_poll_votes v ON v.poll_id = c.poll_id AND v.device_id = c.device_id
        WHERE c.poll_id = ${pollId} AND v.option_id = ${optionId}`
    : await sql`SELECT email, lang FROM webinar_poll_contacts WHERE poll_id = ${pollId}`;
  return rows.map((r) => ({ email: r.email, lang: r.lang }));
}

/* ── Nachlieferungen ─────────────────────────────────────── */

export type Deliverable = {
  id: string;
  webinarId: string;
  titleDe: string;
  titleEn: string;
  quote: string;
  atSec: number | null;
  source: "transcript" | "manual";
  status: "open" | "done" | "dismissed";
  fileKey: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  deliveredAt: Date | null;
};

const toDeliverable = (r: Record<string, unknown>): Deliverable => ({
  id: r.id as string,
  webinarId: r.webinar_id as string,
  titleDe: r.title_de as string,
  titleEn: r.title_en as string,
  quote: r.quote as string,
  atSec: r.at_sec == null ? null : Number(r.at_sec),
  source: r.source as Deliverable["source"],
  status: r.status as Deliverable["status"],
  fileKey: (r.file_key as string) ?? null,
  fileName: (r.file_name as string) ?? null,
  fileType: (r.file_type as string) ?? null,
  fileSize: r.file_size == null ? null : Number(r.file_size),
  linkUrl: (r.link_url as string) ?? null,
  deliveredAt: (r.delivered_at as Date) ?? null
});

export async function listDeliverables(webinarId: string): Promise<Deliverable[]> {
  const rows = await sql`SELECT * FROM webinar_deliverables WHERE webinar_id = ${webinarId} ORDER BY sort_order, at_sec NULLS LAST, created_at`;
  return rows.map(toDeliverable);
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  const [r] = await sql`SELECT * FROM webinar_deliverables WHERE id = ${id}`;
  return r ? toDeliverable(r) : null;
}

export async function addDeliverables(
  webinarId: string,
  items: { titleDe: string; titleEn: string; quote: string; atSec: number | null; source: Deliverable["source"] }[],
  createdBy: string
): Promise<number> {
  const [{ max }] = await sql`SELECT COALESCE(MAX(sort_order), 0)::int AS max FROM webinar_deliverables WHERE webinar_id = ${webinarId}`;
  let i = Number(max);
  for (const it of items) {
    await sql`INSERT INTO webinar_deliverables (webinar_id, title_de, title_en, quote, at_sec, source, sort_order, created_by)
      VALUES (${webinarId}, ${it.titleDe}, ${it.titleEn}, ${it.quote}, ${it.atSec}, ${it.source}, ${++i}, ${createdBy})`;
  }
  return items.length;
}

export async function setDeliverableFile(
  id: string,
  f: { fileKey: string | null; fileName: string | null; fileType: string | null; fileSize: number | null; linkUrl: string | null }
): Promise<void> {
  const done = Boolean(f.fileKey || f.linkUrl);
  await sql`UPDATE webinar_deliverables SET file_key = ${f.fileKey}, file_name = ${f.fileName}, file_type = ${f.fileType}, file_size = ${f.fileSize},
    link_url = ${f.linkUrl}, status = ${done ? "done" : "open"}, delivered_at = ${done ? new Date() : null} WHERE id = ${id}`;
}

export async function updateDeliverable(id: string, patch: { titleDe?: string; titleEn?: string; status?: Deliverable["status"] }): Promise<void> {
  if (patch.titleDe !== undefined) await sql`UPDATE webinar_deliverables SET title_de = ${patch.titleDe}, title_en = ${patch.titleEn ?? ""} WHERE id = ${id}`;
  if (patch.status !== undefined) await sql`UPDATE webinar_deliverables SET status = ${patch.status} WHERE id = ${id}`;
}

export async function deleteDeliverable(id: string): Promise<string | null> {
  const [r] = await sql`DELETE FROM webinar_deliverables WHERE id = ${id} RETURNING file_key`;
  return (r?.file_key as string) ?? null;
}
