import { z } from "zod";
import { callClaudeTool, claudeConfigured } from "./claude";
import type { Transcript } from "./fireflies";
import { transcriptText } from "./fireflies";

/**
 * Analysiert einen Democall mit Claude: Hat der Interessent eine Offerte verlangt, und mit welchen Eckdaten?
 * Benötigt ANTHROPIC_API_KEY. Modell über ANTHROPIC_MODEL überschreibbar.
 */

export const analysisSchema = z.object({
  offerRequested: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.string(),
  language: z.enum(["de", "en"]),
  company: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  units: z.number().int().positive().nullable(),
  bookingsPerYear: z.number().int().positive().nullable(),
  model: z.enum(["per_unit", "per_booking", "unknown"]),
  billing: z.enum(["monthly", "yearly", "unknown"]),
  channelManager: z.boolean().nullable(),
  startDate: z.string().nullable(),
  addressForm: z.enum(["du", "sie"]).default("sie"),
  agreedDiscountPercent: z.number().min(0).max(100).nullable().default(null),
  pricingDiscussed: z.string().nullable().default(null),
  nextStep: z.string().nullable().default(null),
  onboardingFee: z.number().min(0).max(1_000_000).nullable().default(null),
  onboardingCurrency: z.string().max(8).nullable().default(null),
  onboardingNote: z.string().nullable().default(null),
  salutation: z.string().nullable().default(null),
  needs: z.array(z.string()),
  summary: z.string()
});
export type CallAnalysis = z.infer<typeof analysisSchema>;

const TOOL = {
  name: "record_call_analysis",
  description: "Hält das Ergebnis der Analyse eines Elev8-Democalls fest.",
  input_schema: {
    type: "object",
    properties: {
      offerRequested: {
        type: "boolean",
        description:
          "true nur, wenn der Interessent ausdrücklich ein Angebot, eine Offerte, ein Proposal, einen Preisvorschlag oder Vertragsunterlagen verlangt hat ODER der Elev8-Mitarbeiter mit Zustimmung des Interessenten zugesagt hat, eines zu schicken. Allgemeine Preisfragen allein reichen nicht."
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      evidence: {
        type: "string",
        description: "Kurz in eigenen Worten (max. 2 Sätze), wo im Gespräch der Wunsch geäussert wurde oder warum keiner erkennbar ist."
      },
      language: { type: "string", enum: ["de", "en"], description: "Sprache, in der der Interessent kommuniziert." },
      company: { type: ["string", "null"], description: "Firmenname des Interessenten, falls genannt." },
      contactName: { type: ["string", "null"], description: "Vollständiger Name der Ansprechperson beim Interessenten." },
      contactEmail: { type: ["string", "null"] },
      units: {
        type: ["integer", "null"],
        description: "Anzahl buchbarer Einheiten (Units, Zimmer, Apartments, Listings), die über Elev8 laufen sollen."
      },
      bookingsPerYear: { type: ["integer", "null"], description: "Geschätzte Buchungen pro Jahr, falls genannt." },
      model: {
        type: "string",
        enum: ["per_unit", "per_booking", "unknown"],
        description: "Bevorzugtes Preismodell: per_unit (Abo pro Einheit und Monat) oder per_booking (Prepaid-Buchungskontingent)."
      },
      billing: { type: "string", enum: ["monthly", "yearly", "unknown"], description: "Gewünschte Zahlungsweise beim Per-Unit-Abo." },
      channelManager: {
        type: ["boolean", "null"],
        description: "true, wenn der Interessent den Elev8 Channel Manager braucht (z.B. Anbindung Airbnb/Booking.com über Elev8)."
      },
      startDate: { type: ["string", "null"], description: "Gewünschter Start als ISO-Datum oder kurze Angabe wie 'Ende Oktober'." },
      addressForm: {
        type: "string",
        enum: ["du", "sie"],
        description: "Wie die Elev8-Person den Interessenten im Gespräch angesprochen hat (bei Englisch: 'sie' bei formellem, 'du' bei lockerem Ton)."
      },
      agreedDiscountPercent: {
        type: ["number", "null"],
        description: "Nur wenn im Gespräch ein konkreter Rabatt in Prozent zugesagt wurde, sonst null."
      },
      pricingDiscussed: {
        type: ["string", "null"],
        description: "Kurz in eigenen Worten, was zu Preisen, Budget oder Konditionen besprochen wurde. null, wenn nichts."
      },
      nextStep: {
        type: ["string", "null"],
        description: "Der im Gespräch vereinbarte nächste Schritt (z.B. Entscheid bis Freitag, Folgetermin, Testzugang). null, wenn keiner."
      },
      onboardingFee: {
        type: ["number", "null"],
        description:
          "Nur wenn im Gespräch eine Onboarding-, Einrichtungs- oder Setup-Gebühr mit Betrag genannt wurde: der Betrag als Zahl. Sonst null. Nichts schätzen."
      },
      onboardingCurrency: {
        type: ["string", "null"],
        description: "Währung der genannten Onboarding-Gebühr (z.B. USD, CHF, EUR), falls genannt, sonst null."
      },
      onboardingNote: {
        type: ["string", "null"],
        description: "Kurz, was zum Onboarding vereinbart wurde (z.B. 'inkl. Datenmigration und Schulung'), sonst null."
      },
      salutation: {
        type: ["string", "null"],
        description:
          "Passende Anrede für die Offerte, wie im Gespräch üblich: bei Sie-Form mit Nachnamen und Herr/Frau, wenn eindeutig erkennbar (z.B. 'Guten Tag Herr Kümin'), bei Du-Form mit Vornamen (z.B. 'Hallo Rico'). null, wenn unklar."
      },
      needs: {
        type: "array",
        items: { type: "string" },
        description: "Max. 6 kurze Punkte, was der Interessent konkret braucht (für die Offerte, in seiner Sprache)."
      },
      summary: { type: "string", description: "2 bis 3 Sätze Zusammenfassung des Calls in der Sprache des Interessenten." }
    },
    required: [
      "offerRequested", "confidence", "evidence", "language", "company", "contactName", "contactEmail", "units",
      "bookingsPerYear", "model", "billing", "channelManager", "startDate", "addressForm", "agreedDiscountPercent",
      "pricingDiscussed", "nextStep", "onboardingFee", "onboardingCurrency", "onboardingNote", "salutation", "needs", "summary"
    ]
  }
} as const;

const SYSTEM = `Du analysierst Transkripte von Demo-Calls der Elev8 Suite, einer Software für Ferienwohnungs- und Property-Manager.
Elev8 verkauft zwei Preismodelle: "Per Unit" (Abo pro Einheit und Monat, 12 Monate Laufzeit, monatlich oder jährlich bezahlt) und "Per Booking" (Prepaid-Kontingent von 50, 250 oder 1000 Buchungen, optional mit Channel Manager).
Deine Aufgabe: Erkennen, ob der Interessent eine Offerte bzw. ein Angebot wünscht, und die Eckdaten für dieses Angebot herausziehen.
Sei streng: Nur wenn ein Angebot wirklich verlangt oder verbindlich zugesagt wurde, ist offerRequested true. Erfinde keine Zahlen; was nicht genannt wurde, ist null oder "unknown".
Teilnehmer mit diesen Domains gehören zu Elev8 und sind NICHT der Interessent: {internal}.`;

export const analysisConfigured = claudeConfigured;

export async function analyzeCall(t: Transcript, internal: string[]): Promise<CallAnalysis> {
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
    maxTokens: 2000
  });
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Analyse unvollständig: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return parsed.data;
}
