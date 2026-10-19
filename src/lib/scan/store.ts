import { sql } from "@/lib/db";
import type { ScanHistoryEntry } from "./types";

type Row = Record<string, unknown>;

function toEntry(r: Row): ScanHistoryEntry {
  return {
    id: String(r.id),
    userName: String(r.user_name ?? ""),
    eventId: (r.event_id as string | null) ?? null,
    contactId: (r.contact_id as string | null) ?? null,
    isNew: r.is_new !== false,
    name: String(r.name ?? ""),
    company: String(r.company ?? ""),
    tags: (r.tags as string[] | null) ?? [],
    createdAt: (r.created_at as Date).toISOString()
  };
}

export type NewHistoryEntry = {
  userId: string;
  userName: string;
  userEmail: string;
  eventId: string | null;
  contactId: string | null;
  isNew: boolean;
  name: string;
  company: string;
  email: string;
  phone: string;
  tags: string[];
  sourceType: string;
  photos: number;
};

export async function addHistory(e: NewHistoryEntry): Promise<void> {
  await sql`
    INSERT INTO scan_history (user_id, user_name, user_email, event_id, contact_id, is_new, name, company, email, phone, tags, source_type, photos)
    VALUES (${e.userId}, ${e.userName}, ${e.userEmail}, ${e.eventId}, ${e.contactId}, ${e.isNew}, ${e.name}, ${e.company},
            ${e.email}, ${e.phone}, ${sql.array(e.tags)}, ${e.sourceType}, ${e.photos})`;
}

/** Letzte Scans des ganzen Teams (für die Liste im Modul) */
export async function recentHistory(limit = 50): Promise<ScanHistoryEntry[]> {
  const rows = await sql`SELECT * FROM scan_history ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(toEntry);
}

export async function countToday(userId: string): Promise<{ mine: number; team: number }> {
  const [row] = await sql`
    SELECT count(*) FILTER (WHERE user_id = ${userId})::int AS mine, count(*)::int AS team
    FROM scan_history WHERE created_at >= date_trunc('day', now())`;
  return { mine: Number(row?.mine ?? 0), team: Number(row?.team ?? 0) };
}
