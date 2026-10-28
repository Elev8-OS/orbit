import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/platform/crypto";
import type { RawMessage, Relevance } from "./types";

// ── Einstellungen ───────────────────────────────────────────

export type Settings = { userId: string; enabled: boolean; runHour: number; timezone: string; interests: string; locale: "de" | "en" };
type SettingsRow = { user_id: string; enabled: boolean; run_hour: number; timezone: string; interests: string; locale: string };

const toSettings = (r: SettingsRow): Settings => ({
  userId: r.user_id,
  enabled: r.enabled,
  runHour: Number(r.run_hour),
  timezone: r.timezone,
  interests: r.interests,
  locale: r.locale === "en" ? "en" : "de"
});

export async function getSettings(userId: string): Promise<Settings> {
  await sql`INSERT INTO radar_settings (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
  const [row] = await sql<SettingsRow[]>`SELECT * FROM radar_settings WHERE user_id = ${userId}`;
  return toSettings(row);
}

export async function updateSettings(userId: string, patch: Partial<Pick<Settings, "enabled" | "runHour" | "interests" | "locale">>) {
  const next = { ...(await getSettings(userId)), ...patch };
  await sql`
    UPDATE radar_settings SET enabled = ${next.enabled}, run_hour = ${next.runHour}, interests = ${next.interests},
      locale = ${next.locale}, updated_at = now()
    WHERE user_id = ${userId}`;
  return getSettings(userId);
}

// ── Verbindungen ────────────────────────────────────────────

export type Connection = {
  id: number;
  userId: string;
  kind: string;
  label: string;
  config: Record<string, unknown>;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
};
export type ConnectionWithToken = Connection & { token: string | null };

type ConnectionRow = {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  config: unknown;
  secret: string | null;
  enabled: boolean;
  last_run_at: Date | null;
  last_error: string | null;
};

/**
 * jsonb liest postgres.js als Objekt. Zwischenzeitlich wurde die Konfiguration doppelt kodiert gespeichert
 * (als JSON-Text in jsonb); solche Zeilen werden hier mitgelesen, damit bestehende Verbindungen weiter funktionieren.
 */
function parseConfig(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const toConnection = (r: ConnectionRow): Connection => ({
  id: Number(r.id),
  userId: r.user_id,
  kind: r.kind,
  label: r.label,
  config: parseConfig(r.config),
  enabled: r.enabled,
  lastRunAt: r.last_run_at?.toISOString() ?? null,
  lastError: r.last_error
});

export async function listConnections(userId: string): Promise<Connection[]> {
  const rows = await sql<ConnectionRow[]>`SELECT * FROM radar_connections WHERE user_id = ${userId} ORDER BY id`;
  return rows.map(toConnection);
}

/** Aktive Verbindungen mit entschlüsseltem Token, nur für den Hintergrundlauf. */
export async function activeConnections(userId: string): Promise<ConnectionWithToken[]> {
  const rows = await sql<ConnectionRow[]>`SELECT * FROM radar_connections WHERE user_id = ${userId} AND enabled ORDER BY id`;
  return rows.map((r) => ({ ...toConnection(r), token: r.secret ? decrypt(r.secret) : null }));
}

export async function createConnection(input: { userId: string; kind: string; label: string; config: Record<string, unknown>; token: string | null }): Promise<number> {
  // sql.json statt JSON.stringify(...)::jsonb: sonst kodiert postgres.js den Text ein zweites Mal
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO radar_connections (user_id, kind, label, config, secret)
    VALUES (${input.userId}, ${input.kind}, ${input.label}, ${sql.json(input.config as Parameters<typeof sql.json>[0])}, ${input.token ? encrypt(input.token) : null})
    RETURNING id`;
  return Number(row.id);
}

export async function setConnectionEnabled(userId: string, id: number, enabled: boolean) {
  await sql`UPDATE radar_connections SET enabled = ${enabled} WHERE user_id = ${userId} AND id = ${id}`;
}

/** Löscht Verbindung samt gespeicherten Nachrichten (ON DELETE CASCADE). */
export async function deleteConnection(userId: string, id: number) {
  await sql`DELETE FROM radar_connections WHERE user_id = ${userId} AND id = ${id}`;
}

export async function markConnection(id: number, error: string | null) {
  if (error) await sql`UPDATE radar_connections SET last_error = ${error.slice(0, 300)}, last_error_at = now() WHERE id = ${id}`;
  else await sql`UPDATE radar_connections SET last_run_at = now(), last_error = NULL, last_error_at = NULL WHERE id = ${id}`;
}

// ── Nachrichten ─────────────────────────────────────────────

/** Speichert Rohnachrichten. Schon bekannte werden ignoriert. Liefert die Zahl der neuen. */
export async function insertMessages(userId: string, connectionId: number, kind: string, msgs: RawMessage[]): Promise<number> {
  let added = 0;
  for (const m of msgs) {
    const rows = await sql`
      INSERT INTO radar_messages (user_id, connection_id, kind, external_id, channel, author, posted_at, body, context, url, thread_id)
      VALUES (${userId}, ${connectionId}, ${kind}, ${m.externalId}, ${m.channel}, ${m.author}, ${m.postedAt}, ${m.body}, ${m.context}, ${m.url}, ${m.threadId})
      ON CONFLICT (connection_id, external_id) DO NOTHING
      RETURNING id`;
    if (rows.length) added++;
  }
  return added;
}

export type Pending = { id: number; channel: string; author: string; postedAt: string; body: string; context: string };

export async function pendingMessages(userId: string, limit: number): Promise<Pending[]> {
  const rows = await sql<{ id: string; channel: string; author: string; posted_at: Date; body: string; context: string }[]>`
    SELECT id, channel, author, posted_at, body, context FROM radar_messages
    WHERE user_id = ${userId} AND triaged_at IS NULL ORDER BY posted_at ASC LIMIT ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), channel: r.channel, author: r.author, postedAt: r.posted_at.toISOString(), body: r.body, context: r.context }));
}

export type Triage = {
  relevant: boolean;
  relevance: Relevance;
  category: string;
  title: string;
  summary: string;
  recommendation: string;
  reason: string;
};

export async function saveTriage(userId: string, id: number, t: Triage) {
  await sql`
    UPDATE radar_messages SET triaged_at = now(), relevant = ${t.relevant}, relevance = ${t.relevance}, category = ${t.category},
      title = ${t.title}, summary = ${t.summary}, recommendation = ${t.recommendation}, reason = ${t.reason}, updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}`;
}

/** Nicht Relevantes nach 30 Tagen löschen, damit keine Slack-Inhalte unnötig liegen bleiben. */
export async function purgeOld(userId: string) {
  await sql`DELETE FROM radar_messages WHERE user_id = ${userId} AND relevant = false AND collected_at < now() - interval '30 days'`;
}

export type Item = {
  id: number;
  kind: string;
  channel: string;
  author: string;
  postedAt: string;
  url: string | null;
  title: string;
  summary: string;
  recommendation: string;
  reason: string;
  category: string;
  relevance: Relevance;
  excerpt: string;
  status: "open" | "done" | "discarded";
};

type ItemRow = {
  id: string;
  kind: string;
  channel: string;
  author: string;
  posted_at: Date;
  url: string | null;
  title: string | null;
  summary: string | null;
  recommendation: string | null;
  reason: string | null;
  category: string | null;
  relevance: string | null;
  body: string;
  status: Item["status"];
};

const toItem = (r: ItemRow): Item => ({
  id: Number(r.id),
  kind: r.kind,
  channel: r.channel,
  author: r.author,
  postedAt: r.posted_at.toISOString(),
  url: r.url && /^https?:\/\//i.test(r.url) ? r.url : null,
  title: r.title ?? "",
  summary: r.summary ?? "",
  recommendation: r.recommendation ?? "",
  reason: r.reason ?? "",
  category: r.category ?? "other",
  relevance: r.relevance === "high" || r.relevance === "low" ? r.relevance : "normal",
  excerpt: r.body.slice(0, 600),
  status: r.status
});

export async function listItems(userId: string, view: "open" | "done", limit = 100): Promise<Item[]> {
  const rows =
    view === "open"
      ? await sql<ItemRow[]>`SELECT * FROM radar_messages WHERE user_id = ${userId} AND relevant AND status = 'open'
          ORDER BY (relevance = 'high') DESC, posted_at DESC LIMIT ${limit}`
      : await sql<ItemRow[]>`SELECT * FROM radar_messages WHERE user_id = ${userId} AND relevant AND status IN ('done', 'discarded')
          ORDER BY updated_at DESC LIMIT ${limit}`;
  return rows.map(toItem);
}

export async function setItemStatus(userId: string, id: number, status: Item["status"]) {
  await sql`UPDATE radar_messages SET status = ${status}, updated_at = now() WHERE user_id = ${userId} AND id = ${id} AND relevant`;
}

export async function counts(userId: string): Promise<{ open: number; high: number }> {
  const [row] = await sql<{ open: number; high: number }[]>`
    SELECT count(*) FILTER (WHERE status = 'open')::int AS open,
           count(*) FILTER (WHERE status = 'open' AND relevance = 'high')::int AS high
    FROM radar_messages WHERE user_id = ${userId} AND relevant`;
  return row ?? { open: 0, high: 0 };
}

/** Für „Mein Tag“: offene Einträge der letzten 7 Tage, Wichtiges zuerst. */
export async function todayItems(userId: string, limit: number): Promise<{ items: Item[]; total: number; high: number }> {
  const [rows, [c]] = await Promise.all([
    sql<ItemRow[]>`
      SELECT * FROM radar_messages WHERE user_id = ${userId} AND relevant AND status = 'open' AND posted_at > now() - interval '7 days'
      ORDER BY (relevance = 'high') DESC, posted_at DESC LIMIT ${limit}`,
    sql<{ total: number; high: number }[]>`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE relevance = 'high')::int AS high FROM radar_messages
      WHERE user_id = ${userId} AND relevant AND status = 'open' AND posted_at > now() - interval '7 days'`
  ]);
  return { items: rows.map(toItem), total: c?.total ?? 0, high: c?.high ?? 0 };
}

// ── Läufe ───────────────────────────────────────────────────

export type RunInfo = { runDate: string; startedAt: string; finishedAt: string | null; collected: number; relevant: number; error: string | null; running: boolean };

export async function lastRun(userId: string): Promise<RunInfo | null> {
  const [r] = await sql<
    { run_date: Date; started_at: Date; finished_at: Date | null; collected: number; relevant: number; error: string | null; running: boolean }[]
  >`
    SELECT run_date, started_at, finished_at, collected, relevant, error,
           (finished_at IS NULL AND started_at > now() - interval '15 minutes') AS running
    FROM radar_runs WHERE user_id = ${userId} ORDER BY started_at DESC LIMIT 1`;
  if (!r) return null;
  return {
    runDate: r.run_date.toISOString().slice(0, 10),
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    collected: r.collected,
    relevant: r.relevant,
    error: r.error,
    running: r.running
  };
}

/** Fällig: noch kein Lauf heute, oder ein fehlgeschlagener/abgebrochener (höchstens 3 Versuche, 30 Minuten Abstand). */
export async function runIsDue(userId: string, date: string): Promise<boolean> {
  const [r] = await sql<{ due: boolean }[]>`
    SELECT (attempts < 3 AND started_at < now() - interval '30 minutes' AND (error IS NOT NULL OR finished_at IS NULL)) AS due
    FROM radar_runs WHERE user_id = ${userId} AND run_date = ${date}::date`;
  return r ? r.due : true;
}

export async function startRun(userId: string, date: string) {
  await sql`
    INSERT INTO radar_runs (user_id, run_date) VALUES (${userId}, ${date}::date)
    ON CONFLICT (user_id, run_date) DO UPDATE SET attempts = radar_runs.attempts + 1, started_at = now(), finished_at = NULL, error = NULL`;
}

export async function finishRun(userId: string, date: string, r: { collected: number; relevant: number; error: string | null }) {
  await sql`
    UPDATE radar_runs SET finished_at = now(), collected = ${r.collected}, relevant = ${r.relevant}, error = ${r.error?.slice(0, 500) ?? null}
    WHERE user_id = ${userId} AND run_date = ${date}::date`;
}

/** Personen mit aktiver Auswertung und mindestens einer aktiven Verbindung. */
export async function usersWithRadar(): Promise<{ userId: string; runHour: number; timezone: string }[]> {
  const rows = await sql<{ user_id: string; run_hour: number; timezone: string }[]>`
    SELECT s.user_id, s.run_hour, s.timezone FROM radar_settings s
    WHERE s.enabled AND EXISTS (SELECT 1 FROM radar_connections c WHERE c.user_id = s.user_id AND c.enabled)`;
  return rows.map((r) => ({ userId: r.user_id, runHour: Number(r.run_hour), timezone: r.timezone }));
}
