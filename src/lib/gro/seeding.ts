import { sql } from "@/lib/db";
import { SEED_CONSTANTS, SEED_ESCALATIONS, SEED_OPEN_ITEMS, SEED_PROCESSES, SEED_SHORTCUTS, SEED_TEMPLATES } from "./seed";

export const OWNER_DEFAULT = "";

/** Schreibt den Start-Inhalt in die Vorlagen-Bibliothek (überschreibt dort gleichnamige Einträge). */
export async function loadTemplateLibrary(): Promise<void> {
  const [t] = await sql`SELECT id FROM gro_tenants WHERE is_template`;
  if (!t) throw new Error("Vorlagen-Mandant fehlt (Migration 030)");
  const id = String(t.id);
  await sql.begin(async (tx) => {
    for (const c of SEED_CONSTANTS) {
      await tx`INSERT INTO gro_constants (tenant_id, key, label, value, num, unit, note) VALUES (${id}, ${c.key}, ${c.label}, ${c.value}, ${c.num}, ${c.unit}, ${c.note})
               ON CONFLICT (tenant_id, key) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, num = EXCLUDED.num, unit = EXCLUDED.unit, note = EXCLUDED.note`;
    }
    let sort = 0;
    for (const p of SEED_PROCESSES) {
      sort += 10;
      await tx`INSERT INTO gro_processes (tenant_id, key, grp, title, region, trigger_text, goal, steps, rules, escalation, open_points, origin, sort)
               VALUES (${id}, ${p.key}, ${p.grp}, ${p.title}, ${p.region}, ${p.trigger}, ${p.goal}, ${tx.json(p.steps as never)}, ${tx.json((p.rules ?? []) as never)},
                       ${p.escalation ?? ""}, ${tx.json((p.open ?? []) as never)}, ${p.origin ?? "handbuch"}, ${sort})
               ON CONFLICT (tenant_id, key) DO UPDATE SET grp = EXCLUDED.grp, title = EXCLUDED.title, region = EXCLUDED.region, trigger_text = EXCLUDED.trigger_text,
                 goal = EXCLUDED.goal, steps = EXCLUDED.steps, rules = EXCLUDED.rules, escalation = EXCLUDED.escalation, open_points = EXCLUDED.open_points,
                 origin = EXCLUDED.origin, sort = EXCLUDED.sort`;
    }
    sort = 0;
    for (const [phrase, key] of SEED_SHORTCUTS) {
      sort += 10;
      await tx`INSERT INTO gro_shortcuts (tenant_id, phrase, process_key, sort) VALUES (${id}, ${phrase}, ${key}, ${sort})
               ON CONFLICT (tenant_id, phrase) DO UPDATE SET process_key = EXCLUDED.process_key, sort = EXCLUDED.sort`;
    }
    sort = 0;
    for (const [topic, target] of SEED_ESCALATIONS) {
      sort += 10;
      await tx`INSERT INTO gro_escalations (tenant_id, topic, target, sort) VALUES (${id}, ${topic}, ${target}, ${sort})
               ON CONFLICT (tenant_id, topic) DO UPDATE SET target = EXCLUDED.target, sort = EXCLUDED.sort`;
    }
    sort = 0;
    for (const m of SEED_TEMPLATES) {
      sort += 10;
      await tx`INSERT INTO gro_templates (tenant_id, key, title, lang, when_text, body, sort) VALUES (${id}, ${m.key}, ${m.title}, ${m.lang}, ${m.when}, ${m.body}, ${sort})
               ON CONFLICT (tenant_id, key) DO UPDATE SET title = EXCLUDED.title, lang = EXCLUDED.lang, when_text = EXCLUDED.when_text, body = EXCLUDED.body, sort = EXCLUDED.sort`;
    }
    sort = 0;
    for (const o of SEED_OPEN_ITEMS) {
      sort += 10;
      await tx`INSERT INTO gro_open_items (tenant_id, key, title, question, proposal, sort) VALUES (${id}, ${o.key}, ${o.title}, ${o.question}, ${o.proposal ?? ""}, ${sort})
               ON CONFLICT (tenant_id, key) DO UPDATE SET title = EXCLUDED.title, question = EXCLUDED.question, proposal = EXCLUDED.proposal, sort = EXCLUDED.sort`;
    }
  });
}

/** Kopiert alles, was beim Mandanten noch fehlt, aus der Vorlagen-Bibliothek. Bestehende Einträge bleiben unverändert. */
export async function adoptTemplate(targetId: string): Promise<{ added: number }> {
  const [t] = await sql`SELECT id FROM gro_tenants WHERE is_template`;
  if (!t) throw new Error("Vorlagen-Mandant fehlt");
  const src = String(t.id);
  let added = 0;
  await sql.begin(async (tx) => {
    const count = (r: { count: number }) => (added += Number(r.count));
    count(await tx`INSERT INTO gro_constants (tenant_id, key, label, value, num, unit, note) SELECT ${targetId}, key, label, value, num, unit, note FROM gro_constants WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
    count(await tx`INSERT INTO gro_processes (tenant_id, key, grp, title, region, role, trigger_text, goal, steps, rules, escalation, open_points, origin, sort)
                   SELECT ${targetId}, key, grp, title, region, role, trigger_text, goal, steps, rules, escalation, open_points, origin, sort FROM gro_processes WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
    count(await tx`INSERT INTO gro_shortcuts (tenant_id, phrase, process_key, sort) SELECT ${targetId}, phrase, process_key, sort FROM gro_shortcuts WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
    count(await tx`INSERT INTO gro_escalations (tenant_id, topic, target, sort) SELECT ${targetId}, topic, target, sort FROM gro_escalations WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
    count(await tx`INSERT INTO gro_templates (tenant_id, key, title, lang, when_text, body, sort) SELECT ${targetId}, key, title, lang, when_text, body, sort FROM gro_templates WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
    count(await tx`INSERT INTO gro_open_items (tenant_id, key, title, question, proposal, sort) SELECT ${targetId}, key, title, question, proposal, sort FROM gro_open_items WHERE tenant_id = ${src} ON CONFLICT DO NOTHING`);
  });
  return { added };
}
