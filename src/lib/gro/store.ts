import { sql } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/platform/crypto";
import { toTenant } from "./access";
import type { Constant, Escalation, MessageTemplate, ObjectOverlay, OpenItem, Process, Shortcut, Tenant } from "./types";

type Row = Record<string, unknown>;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);
const strs = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);

export function toProcess(r: Row): Process {
  return {
    id: String(r.id),
    key: String(r.key),
    grp: String(r.grp),
    title: String(r.title),
    region: String(r.region),
    role: String(r.role),
    trigger: String(r.trigger_text ?? ""),
    goal: String(r.goal ?? ""),
    steps: strs(r.steps),
    rules: strs(r.rules),
    escalation: String(r.escalation ?? ""),
    openPoints: strs(r.open_points),
    origin: String(r.origin),
    status: r.status === "freigegeben" ? "freigegeben" : "entwurf",
    version: Number(r.version),
    owner: String(r.owner ?? ""),
    reviewedAt: r.reviewed_at instanceof Date ? r.reviewed_at.toISOString().slice(0, 10) : (r.reviewed_at as string | null) ?? null,
    sort: Number(r.sort),
    updatedAt: iso(r.updated_at) ?? "",
    updatedBy: (r.updated_by as string | null) ?? null
  };
}

export const listProcesses = async (tenantId: string): Promise<Process[]> =>
  (await sql`SELECT * FROM gro_processes WHERE tenant_id = ${tenantId} ORDER BY sort, key`).map(toProcess);

export async function getProcess(tenantId: string, key: string): Promise<Process | null> {
  const [r] = await sql`SELECT * FROM gro_processes WHERE tenant_id = ${tenantId} AND key = ${key}`;
  return r ? toProcess(r) : null;
}

export type ProcessEdit = Pick<Process, "title" | "grp" | "region" | "role" | "trigger" | "goal" | "steps" | "rules" | "escalation" | "openPoints" | "status" | "owner">;

/** Speichert eine Änderung, erhöht die Version und legt den vorherigen Stand ins Protokoll */
export async function saveProcess(tenantId: string, key: string, e: ProcessEdit, by: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [cur] = await tx`SELECT * FROM gro_processes WHERE tenant_id = ${tenantId} AND key = ${key} FOR UPDATE`;
    if (!cur) throw new Error("Prozess nicht gefunden");
    await tx`INSERT INTO gro_process_versions (process_id, version, snapshot, changed_by)
             VALUES (${cur.id}, ${cur.version}, ${tx.json(toProcess(cur) as never)}, ${by}) ON CONFLICT DO NOTHING`;
    await tx`UPDATE gro_processes SET title = ${e.title}, grp = ${e.grp}, region = ${e.region}, role = ${e.role}, trigger_text = ${e.trigger},
               goal = ${e.goal}, steps = ${tx.json(e.steps as never)}, rules = ${tx.json(e.rules as never)}, escalation = ${e.escalation},
               open_points = ${tx.json(e.openPoints as never)}, status = ${e.status}, owner = ${e.owner},
               reviewed_at = CASE WHEN ${e.status} = 'freigegeben' THEN CURRENT_DATE ELSE reviewed_at END,
               version = version + 1, updated_by = ${by}, updated_at = now()
             WHERE id = ${cur.id}`;
  });
}

export async function processVersions(processId: string) {
  const rows = await sql<{ version: number; changed_by: string | null; changed_at: Date }[]>`
    SELECT version, changed_by, changed_at FROM gro_process_versions WHERE process_id = ${processId} ORDER BY version DESC LIMIT 20`;
  return rows.map((r) => ({ version: r.version, by: r.changed_by, at: r.changed_at.toISOString() }));
}

export const listConstants = async (tenantId: string): Promise<Constant[]> =>
  (await sql`SELECT * FROM gro_constants WHERE tenant_id = ${tenantId} ORDER BY label`).map((r) => ({
    key: String(r.key),
    label: String(r.label),
    value: String(r.value),
    num: r.num === null ? null : Number(r.num),
    unit: String(r.unit),
    note: String(r.note)
  }));

export async function saveConstant(tenantId: string, c: Constant, by: string) {
  await sql`INSERT INTO gro_constants (tenant_id, key, label, value, num, unit, note, updated_by)
            VALUES (${tenantId}, ${c.key}, ${c.label}, ${c.value}, ${c.num}, ${c.unit}, ${c.note}, ${by})
            ON CONFLICT (tenant_id, key) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, num = EXCLUDED.num,
              unit = EXCLUDED.unit, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export const listTemplates = async (tenantId: string): Promise<MessageTemplate[]> =>
  (await sql`SELECT * FROM gro_templates WHERE tenant_id = ${tenantId} ORDER BY sort, key`).map((r) => ({
    id: String(r.id), key: String(r.key), title: String(r.title), lang: String(r.lang), when: String(r.when_text), body: String(r.body), sort: Number(r.sort)
  }));

export async function saveTemplate(tenantId: string, key: string, body: string) {
  await sql`UPDATE gro_templates SET body = ${body} WHERE tenant_id = ${tenantId} AND key = ${key}`;
}

export const listShortcuts = async (tenantId: string): Promise<Shortcut[]> =>
  (await sql`SELECT * FROM gro_shortcuts WHERE tenant_id = ${tenantId} ORDER BY sort, phrase`).map((r) => ({ id: String(r.id), phrase: String(r.phrase), processKey: String(r.process_key) }));

export const listEscalations = async (tenantId: string): Promise<Escalation[]> =>
  (await sql`SELECT * FROM gro_escalations WHERE tenant_id = ${tenantId} ORDER BY sort, topic`).map((r) => ({ id: String(r.id), topic: String(r.topic), target: String(r.target) }));

export async function saveEscalation(tenantId: string, id: string, target: string) {
  await sql`UPDATE gro_escalations SET target = ${target} WHERE tenant_id = ${tenantId} AND id = ${id}`;
}

export const listOpenItems = async (tenantId: string): Promise<OpenItem[]> =>
  (await sql`SELECT * FROM gro_open_items WHERE tenant_id = ${tenantId} ORDER BY sort, key`).map((r) => ({
    id: String(r.id), key: String(r.key), title: String(r.title), question: String(r.question), proposal: String(r.proposal),
    status: r.status === "entschieden" ? "entschieden" : "offen", decision: String(r.decision), decidedBy: (r.decided_by as string | null) ?? null, decidedAt: iso(r.decided_at)
  }));

export async function decideOpenItem(tenantId: string, id: string, status: "offen" | "entschieden", decision: string, by: string) {
  await sql`UPDATE gro_open_items SET status = ${status}, decision = ${decision},
              decided_by = ${status === "entschieden" ? by : null}, decided_at = ${status === "entschieden" ? sql`now()` : null}
            WHERE tenant_id = ${tenantId} AND id = ${id}`;
}

export async function listOverlays(tenantId: string): Promise<Map<string, ObjectOverlay>> {
  const rows = await sql`SELECT listing_id, citytax_portal, notes, codes_enc IS NOT NULL AS has_codes FROM gro_objects WHERE tenant_id = ${tenantId}`;
  return new Map(rows.map((r) => [String(r.listing_id), { listingId: String(r.listing_id), citytaxPortal: String(r.citytax_portal), notes: String(r.notes), hasCodes: r.has_codes === true }]));
}

export async function saveOverlay(tenantId: string, listingId: string, portal: string, notes: string, by: string) {
  await sql`INSERT INTO gro_objects (tenant_id, listing_id, citytax_portal, notes, updated_by) VALUES (${tenantId}, ${listingId}, ${portal}, ${notes}, ${by})
            ON CONFLICT (tenant_id, listing_id) DO UPDATE SET citytax_portal = EXCLUDED.citytax_portal, notes = EXCLUDED.notes, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export async function saveCodes(tenantId: string, listingId: string, codes: string, by: string) {
  const sealed = codes.trim() ? encrypt(codes.trim()) : null;
  await sql`INSERT INTO gro_objects (tenant_id, listing_id, codes_enc, updated_by) VALUES (${tenantId}, ${listingId}, ${sealed}, ${by})
            ON CONFLICT (tenant_id, listing_id) DO UPDATE SET codes_enc = EXCLUDED.codes_enc, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export async function readCodes(tenantId: string, listingId: string): Promise<string | null> {
  const [r] = await sql`SELECT codes_enc FROM gro_objects WHERE tenant_id = ${tenantId} AND listing_id = ${listingId}`;
  return r?.codes_enc ? decrypt(String(r.codes_enc)) : null;
}

// ── Mandanten und Mitglieder ─────────────────────────────────────────
export async function tenantSecrets(tenantId: string): Promise<string | null> {
  const [r] = await sql`SELECT elev8_token FROM gro_tenants WHERE id = ${tenantId}`;
  return (r?.elev8_token as string | null) ?? null;
}

export async function listAllTenants(): Promise<Tenant[]> {
  return (await sql`SELECT * FROM gro_tenants ORDER BY is_template DESC, name`).map(toTenant);
}

export async function createTenant(slug: string, name: string): Promise<void> {
  await sql`INSERT INTO gro_tenants (slug, name) VALUES (${slug}, ${name})`;
}

export async function updateConnection(tenantId: string, url: string | null, token: string | null, tags: string[], baseGuests: number) {
  await sql`UPDATE gro_tenants SET elev8_url = ${url}, listing_tags = ${sql.array(tags)}, base_guests = ${baseGuests} WHERE id = ${tenantId}`;
  if (token) await sql`UPDATE gro_tenants SET elev8_token = ${encrypt(token)} WHERE id = ${tenantId}`;
}

export async function listMembers(tenantId: string) {
  const rows = await sql<{ email: string; role: string; can_see_codes: boolean }[]>`SELECT email, role, can_see_codes FROM gro_members WHERE tenant_id = ${tenantId} ORDER BY email`;
  return rows.map((r) => ({ email: r.email, role: r.role, canSeeCodes: r.can_see_codes }));
}

export async function addMember(tenantId: string, email: string, role: string, codes: boolean, by: string) {
  await sql`INSERT INTO gro_members (tenant_id, email, role, can_see_codes, added_by) VALUES (${tenantId}, ${email}, ${role}, ${codes}, ${by})
            ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, can_see_codes = EXCLUDED.can_see_codes`;
}

export async function removeMember(tenantId: string, email: string) {
  await sql`DELETE FROM gro_members WHERE tenant_id = ${tenantId} AND email = ${email}`;
}
