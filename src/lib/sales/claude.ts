import { z } from "zod";
import { callClaudeTool, claudeConfigured, type ToolDef } from "@/lib/offerten/claude";

/**
 * Noah schlägt nach einem Call den nächsten Schritt als Follow-up vor (Titel, Text, Fälligkeit).
 * Nutzt den gemeinsamen Aufruf der Offerten (ANTHROPIC_API_KEY, ANTHROPIC_MODEL).
 */

export const suggestionSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(1200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  basis: z.string().max(400),
  agreed: z.boolean()
});
export type FollowUpSuggestion = z.infer<typeof suggestionSchema>;

const TOOL = {
  name: "propose_follow_up",
  description: "Schlägt den nächsten Schritt nach einem Elev8-Verkaufsgespräch als Follow-up-Task vor.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Kurzer, konkreter Task-Titel als Handlung, max. 80 Zeichen, z.B. 'Nachfassen: Entscheid zu Per-Unit-Abo' oder 'Unterlagen zu Channel Manager schicken'."
      },
      body: {
        type: "string",
        description:
          "2 bis 4 kurze Sätze für den Sales-Mitarbeiter: was vereinbart wurde, worauf er beim Nachfassen eingehen soll, offene Fragen. Keine Floskeln, nichts erfinden."
      },
      dueDate: {
        type: "string",
        description:
          "Fälligkeit als YYYY-MM-DD. Wurde ein Zeitpunkt vereinbart (z.B. 'nächste Woche', 'Ende Monat', 'nach den Ferien'), diesen umrechnen, auf einen Werktag legen. Sonst 3 Werktage nach dem Call, frühestens heute."
      },
      basis: {
        type: "string",
        description: "Ein Satz in eigenen Worten, worauf sich der Vorschlag stützt (vereinbart im Call oder Standard-Abstand)."
      },
      agreed: { type: "boolean", description: "true, wenn der nächste Schritt im Call ausdrücklich vereinbart wurde." }
    },
    required: ["title", "body", "dueDate", "basis", "agreed"]
  }
} as const;

export const suggestionsConfigured = claudeConfigured;

export async function proposeFollowUp(input: {
  language: "de" | "en";
  today: string;
  callDate: string | null;
  title: string;
  company: string | null;
  contactName: string | null;
  summary: string;
  actionItems: string;
  transcript: string;
}): Promise<FollowUpSuggestion> {
  const system = `Du bist Noah und unterstützt das Sales-Team der Elev8 Suite (Software für Ferienwohnungs- und Property-Manager).
Nach jedem Gespräch soll ein klarer nächster Schritt im CRM stehen. Leite ihn aus dem Gespräch ab.
Heute ist ${input.today}. Schreibe Titel und Text auf ${input.language === "en" ? "Englisch" : "Deutsch"}.
Erfinde keine Zusagen, Zahlen oder Termine, die im Gespräch nicht vorkommen.`;

  const user = `Call: ${input.title}
Datum: ${input.callDate ?? "unbekannt"}
Interessent: ${[input.contactName, input.company].filter(Boolean).join(", ") || "unbekannt"}

Zusammenfassung:
${input.summary || "(keine)"}

Aufgaben laut Fireflies:
${input.actionItems || "(keine)"}

Transkript (gekürzt):
${input.transcript || "(nicht verfügbar)"}`;

  // Gemeinsamer Noah-Aufruf der Offerten: kein erzwungenes Tool, Rückfall auf JSON aus dem Text
  const raw = await callClaudeTool({ system, user, tool: TOOL as unknown as ToolDef, maxTokens: 1000, timeoutMs: 90_000 });
  const parsed = suggestionSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Vorschlag unvollständig");
  if (parsed.data.dueDate < input.today) parsed.data.dueDate = input.today;
  return parsed.data;
}
