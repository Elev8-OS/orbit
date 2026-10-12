import { z } from "zod";
import { callClaudeTool } from "@/lib/offerten/claude";
import { escapeHtml } from "@/lib/mail/layout";

/** Einordnen und (wenn nötig) Antwort entwerfen, in einem Aufruf. */
export const decisionSchema = z.object({
  decision: z.enum(["reply", "info", "skip"]),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  summary: z.string().max(400).default(""),
  reason: z.string().max(300).default(""),
  reply: z.string().max(6000).optional().default("")
});
export type Decision = z.infer<typeof decisionSchema>;

const TOOL = {
  name: "triage_email",
  description: "Ordnet eine E-Mail ein und schreibt bei Bedarf einen Antwortentwurf.",
  input_schema: {
    type: "object",
    properties: {
      decision: {
        type: "string",
        enum: ["reply", "info", "skip"],
        description: "reply = die Person sollte persönlich antworten; info = wichtig zu wissen, keine Antwort nötig; skip = unwichtig (Newsletter, Werbung, automatische Meldung)"
      },
      priority: { type: "string", enum: ["high", "normal", "low"] },
      summary: { type: "string", description: "Ein Satz: worum es geht und was erwartet wird. In der Sprache der Oberfläche." },
      reason: { type: "string", description: "Kurze Begründung der Einordnung. In der Sprache der Oberfläche." },
      reply: { type: "string", description: "Nur bei reply: Antworttext als reiner Text mit Absätzen, ohne Betreff und ohne Signatur." }
    },
    required: ["decision", "priority", "summary", "reason"]
  }
};

export type MailInput = {
  ownerName: string;
  ownerEmail: string;
  locale: "de" | "en";
  styleNotes: string;
  fromName: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  subject: string;
  received: string;
  body: string;
};

export async function triage(input: MailInput, model?: string): Promise<Decision> {
  const ui = input.locale === "en" ? "English" : "Deutsch (Schweiz, ohne ß)";
  const kb = process.env.KNOWLEDGE_BASE_URL || "https://docs.elev8-suite.com";
  const system = `Du bist Noah, der E-Mail-Assistent von ${input.ownerName} (${input.ownerEmail}) bei Elev8, einer Software für Ferienwohnungs- und Hotelverwaltung (Elev8 Suite).
Du entscheidest für jede eingehende E-Mail, ob ${input.ownerName} persönlich antworten sollte, und schreibst dann einen Entwurf. Nichts wird automatisch gesendet: ${input.ownerName} prüft jeden Entwurf.

Einordnung:
- reply: Eine Person erwartet eine Antwort von ${input.ownerName} (Frage, Bitte, Terminwunsch, Kunde, Partner, Team).
- info: Relevant, aber keine Antwort nötig (Bestätigung, Weiterleitung zur Kenntnis, Bericht).
- skip: Newsletter, Werbung, Kaltakquise, automatische Benachrichtigung, Rechnungsversand ohne Frage, Spam.
Priorität high nur bei Dringlichkeit, Fristen, Eskalationen oder wichtigen Kunden.

Für den Antwortentwurf:
- Sprache und Anrede wie der Absender (Du oder Sie). Deutsch ohne ß.
- Kurz, freundlich, konkret. Keine Floskeln wie "Ich hoffe, es geht Ihnen gut".
- Nichts erfinden: keine Termine, Preise, Zusagen oder Fakten, die nicht in der Mail stehen. Wo etwas fehlt, eine Lücke in eckigen Klammern lassen, z.B. [Termin einsetzen].
- Bei Produktfragen zur Elev8 Suite darf auf die Wissensdatenbank verwiesen werden: ${kb}
- Ohne Betreff, ohne Signatur, ohne Grussformel-Namen am Schluss (die Signatur wird angehängt).
${input.styleNotes ? `\nPersönlicher Stil und Hinweise von ${input.ownerName}:\n${input.styleNotes}` : ""}

summary und reason schreibst du auf ${ui}.`;
  const user = `Von: ${input.fromName} <${input.fromAddress}>
An: ${input.to.join(", ") || "–"}
Cc: ${input.cc.join(", ") || "–"}
Datum: ${input.received}
Betreff: ${input.subject || "(ohne Betreff)"}

${input.body.slice(0, 8000) || "(kein Text)"}`;
  const raw = await callClaudeTool({ system, user, tool: TOOL, maxTokens: 2000, timeoutMs: 90_000, model });
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Antwort des Assistenten nicht lesbar");
  if (parsed.data.decision === "reply" && !parsed.data.reply.trim()) return { ...parsed.data, decision: "info" };
  return parsed.data;
}

/** Text mit Absätzen und Signatur als HTML für Outlook. */
export function replyHtml(reply: string, signature: string): string {
  const paragraphs = reply
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const sig = signature.trim() ? `<p>${escapeHtml(signature.trim()).replace(/\n/g, "<br>")}</p>` : "";
  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${paragraphs}${sig}</div><br>`;
}

// ── Regeln ohne KI: offensichtlich Automatisches gar nicht erst an Claude schicken ──

const AUTOMATED = /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|newsletter|news|marketing|alerts?|updates?)([._+-]|@)/i;

export function ruleSkip(opts: { fromAddress: string; ownerEmail: string; classification: string | null; skipSenders: string }): string | null {
  const from = opts.fromAddress.toLowerCase();
  if (!from) return "ohne Absender";
  if (from === opts.ownerEmail.toLowerCase()) return "eigene E-Mail";
  if (AUTOMATED.test(from)) return "automatischer Absender";
  if (opts.classification === "other") return "Posteingang „Sonstige“";
  const custom = opts.skipSenders
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .find((s) => from.includes(s));
  if (custom) return `Ausnahme: ${custom}`;
  return null;
}
