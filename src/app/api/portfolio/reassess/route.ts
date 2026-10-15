import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { canEditPortfolio } from "@/lib/portfolio/access";
import { callClaudeTool, claudeConfigured, type ToolDef } from "@/lib/offerten/claude";
import { PROPERTIES } from "@/lib/portfolio/sources";
import { listDocs, setDoc } from "@/lib/portfolio/docs";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const RECS = [
  "Weiterführen & ausbauen",
  "Weiterführen – optimieren",
  "Weiterführen – Langzeitmodell",
  "Weiterführen (Mandat)",
  "Auf Bewährung",
  "Auf Bewährung – kritisch",
  "Exit prüfen",
  "Exit prüfen / Neustart"
] as const;

const input = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/).nullable(),
  info: z.string().max(4000).default(""),
  context: z.string().max(20000).default("")
});

const update = z.object({
  key: z.string(),
  recommendation: z.enum(RECS),
  summary: z.string().min(1).max(600),
  causes: z.string().min(1).max(800),
  actions: z.string().min(1).max(800)
});
const output = z.object({ updates: z.array(update).max(40), note: z.string().max(600).default("") });

const TOOL: ToolDef = {
  name: "save_reassessment",
  description: "Speichert die fachliche Neubeurteilung der Wohnungen im Portfolio-Modul.",
  input_schema: {
    type: "object",
    properties: {
      updates: {
        type: "array",
        description: "Eine Zeile pro neu beurteilter Wohnung. Nur Wohnungen, deren Beurteilung sich durch die neuen Infos oder Zahlen ändert oder die ausdrücklich angefragt sind.",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Schlüssel der Wohnung, z.B. 'laufen'." },
            recommendation: { type: "string", enum: [...RECS] },
            summary: { type: "string", description: "Fazit in 1–2 Sätzen, mit den wichtigsten Zahlen." },
            causes: { type: "string", description: "Ursachen, knapp und konkret." },
            actions: { type: "string", description: "Konkrete Massnahmen mit Zuständigkeit oder Termin, wo sinnvoll." }
          },
          required: ["key", "recommendation", "summary", "causes", "actions"]
        }
      },
      note: { type: "string", description: "Ein bis zwei Sätze für die Person, die die Neubeurteilung angestossen hat." }
    },
    required: ["updates", "note"]
  }
};

const SYSTEM = `Du bist Revenue- und Portfolio-Analyst von Elevate Schweiz (Kurzzeitvermietung, Marke "The R").
Du beurteilst Wohnungen fachlich neu: Empfehlung, Fazit, Ursachen, Massnahmen – auf Deutsch (Schweiz, "ss" statt "ß"), direkt und konkret, ohne Floskeln.
Regeln:
- Eine Wohnung mit negativem Netto nach allen Kosten wird NIE zum Exit empfohlen. Stattdessen Ursachen analysieren und Massnahmen nennen, wie sie wirtschaftlich weitergeführt werden kann (Preis, Mindestaufenthalt, Cleaning Fee, Kosten, Miete nachverhandeln, Kanalmix).
- Mandate (Management mit Honorar) haben keine Fixkosten für Elevate; dort zählen Qualität und Ruf.
- Fehlt die Miete, ist die Beurteilung vorläufig – das im Fazit erwähnen.
- Neue Infos der anfragenden Person haben Vorrang vor älteren Annahmen. Nichts erfinden, was weder in den Infos noch in den Zahlen steht.`;

/** Fachliche Neubeurteilung durch Claude. Ergebnis wird in portfolio_docs (neubeurteilung) gespeichert. */
export async function POST(req: Request) {
  const ctx = await requireUser(canEditPortfolio);
  if ("response" in ctx) return ctx.response;
  if (!claudeConfigured()) return Response.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 503 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { key, info, context } = parsed.data;

  const active = PROPERTIES.filter((p) => p.status === "Aktiv" && (!key || p.key === key));
  if (!active.length) return Response.json({ error: "not_found" }, { status: 404 });
  const saved = new Map((await sql<{ doc_id: string; data: Record<string, string> }[]>`SELECT doc_id, data FROM portfolio_docs WHERE collection = 'neubeurteilung'`).map((r) => [r.doc_id, r.data]));
  const costs = new Map((await listDocs("objektkosten")).map((d) => [d.id, d.data]));

  const current = active
    .map((p) => {
      const s = { ...p, ...(saved.get(p.key) ?? {}) };
      return `### ${p.key} – ${p.name}, ${p.city}\nEmpfehlung: ${s.recommendation}\nFazit: ${s.summary}\nUrsachen: ${s.causes}\nMassnahmen: ${s.actions}\nKosten (erfasst): ${JSON.stringify(costs.get(p.key) ?? {})}`;
    })
    .join("\n\n");

  const user = `Umfang: ${key ? `nur die Wohnung "${key}"` : "gesamtes Schweizer Portfolio"}
Heute: ${new Date().toISOString().slice(0, 10)}

## Neue Infos der anfragenden Person
${info || "(keine – nur mit den aktuellen Zahlen neu beurteilen)"}

## Aktuelle Kennzahlen (letzte 12 Monate, aus dem Dashboard)
${context || "(nicht übermittelt)"}

## Bisherige Beurteilung und erfasste Kosten
${current}`;

  try {
    const raw = await callClaudeTool({ system: SYSTEM, user, tool: TOOL, maxTokens: 6000, timeoutMs: 170_000 });
    const out = output.parse(raw);
    const allowed = new Set(active.map((p) => p.key));
    const at = new Date().toISOString();
    let updated = 0;
    for (const u of out.updates) {
      if (!allowed.has(u.key)) continue;
      await setDoc("neubeurteilung", u.key, { recommendation: u.recommendation, summary: u.summary, causes: u.causes, actions: u.actions, at, by: ctx.user.email, info: info.slice(0, 1000) }, ctx.user.email);
      updated++;
    }
    return Response.json({ ok: true, updated, note: out.note });
  } catch (err) {
    console.error("[portfolio] reassess:", err);
    return Response.json({ error: "Claude konnte die Neubeurteilung nicht erstellen." }, { status: 502 });
  }
}
