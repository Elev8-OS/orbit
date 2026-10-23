import { z } from "zod";
import { callClaudeTool, claudeConfigured } from "@/lib/offerten/claude";
import { transcriptText, type Transcript } from "@/lib/offerten/fireflies";

/**
 * Erkennt in einem Call, ob der Interessent mit Elev8 starten will (Onboarding). Streng: Interesse, Preisfragen oder der
 * Wunsch nach einer Offerte allein reichen nicht. Der Entwurf, der daraus entsteht, wird nie automatisch gesendet.
 * Benötigt ANTHROPIC_API_KEY (wie die Offerten-Analyse).
 */
export const intentSchema = z.object({
  onboardingRequested: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.string(),
  language: z.enum(["de", "en"]),
  company: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contractFirst: z.boolean().nullable().default(null),
  startDate: z.string().nullable().default(null),
  summary: z.string()
});
export type OnboardingIntent = z.infer<typeof intentSchema>;

const TOOL = {
  name: "record_onboarding_intent",
  description: "Hält fest, ob der Interessent in einem Elev8-Call mit dem Onboarding starten will.",
  input_schema: {
    type: "object",
    properties: {
      onboardingRequested: {
        type: "boolean",
        description:
          "true nur, wenn der Interessent ausdrücklich mit Elev8 starten will (zum Beispiel: wir legen los, wir nehmen es, bitte schickt uns den Zugang oder das Onboarding, wir nehmen das Angebot an) ODER der Elev8-Mitarbeiter den Start bzw. die Einladung zum Onboarding zugesagt hat und der Interessent zugestimmt hat. Nicht ausreichend: allgemeines Interesse, Preis- oder Funktionsfragen, der Wunsch nach einer Offerte, 'wir überlegen es uns', ein Folgetermin für eine weitere Demo."
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      evidence: {
        type: "string",
        description: "Kurz in eigenen Worten (max. 2 Sätze), wo im Gespräch der Startwunsch geäussert wurde oder warum keiner erkennbar ist."
      },
      language: { type: "string", enum: ["de", "en"], description: "Sprache, in der der Interessent kommuniziert." },
      company: { type: ["string", "null"], description: "Firmenname des Interessenten, falls genannt." },
      contactName: { type: ["string", "null"], description: "Vollständiger Name der Ansprechperson beim Interessenten." },
      contactEmail: { type: ["string", "null"] },
      contractFirst: {
        type: ["boolean", "null"],
        description: "true, wenn der Interessent den Vertrag vor dem ersten Onboarding-Call erhalten möchte. false, wenn ausdrücklich nicht. null, wenn nicht besprochen."
      },
      startDate: { type: ["string", "null"], description: "Gewünschter Start als ISO-Datum oder kurze Angabe wie 'Ende Oktober', sonst null." },
      summary: { type: "string", description: "2 bis 3 Sätze Zusammenfassung des Calls in der Sprache des Interessenten." }
    },
    required: ["onboardingRequested", "confidence", "evidence", "language", "company", "contactName", "contactEmail", "contractFirst", "startDate", "summary"]
  }
} as const;

const SYSTEM = `Du analysierst Transkripte von Demo- und Verkaufsgesprächen der Elev8 Suite, einer Software für Ferienwohnungs- und Property-Manager.
Nach dem Kauf folgt das Onboarding: Kundenkonto anlegen, Daten aus dem bisherigen PMS übernehmen, drei Calls bis zum Go-live.
Deine Aufgabe: Erkennen, ob der Interessent in diesem Gespräch ausdrücklich mit dem Onboarding starten will.
Sei streng. Ein Entwurf geht an einen Mitarbeiter zur Prüfung, aber ein falscher Alarm kostet Zeit. Erfinde nichts; was nicht gesagt wurde, ist null.
Teilnehmer mit diesen Domains gehören zu Elev8 und sind NICHT der Interessent: {internal}.`;

export const intentConfigured = claudeConfigured;

/** Daraus wird ein Entwurf ("draft"), nur ein Hinweis in der Übersicht ("uncertain") oder nichts ("none"). */
export function decide(i: Pick<OnboardingIntent, "onboardingRequested" | "confidence">): "draft" | "uncertain" | "none" {
  if (!i.onboardingRequested) return "none";
  return i.confidence === "low" ? "uncertain" : "draft";
}

export async function analyzeIntent(t: Transcript, internal: string[]): Promise<OnboardingIntent> {
  const attendees = t.attendees
    .map((a) => `${a.name ?? "?"} <${a.email ?? "?"}>`)
    .concat(t.participants.filter((p) => !t.attendees.some((a) => a.email === p)).map((p) => `<${p}>`))
    .join(", ");

  const userContent = `Titel: ${t.title}
Datum: ${t.dateString ?? "unbekannt"}
Organisator: ${t.organizerEmail ?? "unbekannt"}
Teilnehmer: ${attendees || "unbekannt"}

Fireflies-Zusammenfassung:
${t.summary.shortSummary || t.summary.overview || "(keine)"}

Fireflies-Aufgaben:
${t.summary.actionItems || "(keine)"}

Transkript:
${transcriptText(t)}`;

  const input = await callClaudeTool({
    system: SYSTEM.replace("{internal}", internal.join(", ")),
    user: userContent,
    tool: TOOL as unknown as Parameters<typeof callClaudeTool>[0]["tool"],
    maxTokens: 1500
  });
  const parsed = intentSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Analyse unvollständig: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return parsed.data;
}
