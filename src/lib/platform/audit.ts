import { sql } from "@/lib/db";

export type AuditActor = { id: string; email: string };

/** Schreibt eine Verwaltungsaktion ins Protokoll. Fehler werden nur geloggt, nie geworfen. */
export async function audit(actor: AuditActor | null, action: string, target: string | null, detail?: Record<string, unknown>) {
  try {
    await sql`
      INSERT INTO audit_log (actor_id, actor_email, action, target, detail)
      VALUES (${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${target}, ${detail ? sql.json(detail as never) : null})`;
  } catch (err) {
    console.error("Protokoll nicht geschrieben:", action, err);
  }
}

export type AuditEntry = {
  id: number;
  at: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
};

export async function listAudit(limit = 200, action?: string): Promise<AuditEntry[]> {
  const rows = await sql<{ id: string; at: Date; actor_email: string | null; action: string; target: string | null; detail: Record<string, unknown> | null }[]>`
    SELECT id, at, actor_email, action, target, detail FROM audit_log
    ${action ? sql`WHERE action LIKE ${action + "%"}` : sql``}
    ORDER BY at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), at: r.at.toISOString(), actorEmail: r.actor_email, action: r.action, target: r.target, detail: r.detail }));
}
