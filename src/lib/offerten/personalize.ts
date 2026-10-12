import { z } from "zod";
import { callClaudeTool, claudeConfigured } from "./claude";
import { earlierCalls, firefliesConfigured, getTranscript, isInternalEmail, transcriptText } from "./fireflies";
import * as ghl from "./ghl";
import { computeTotals, formatDate, formatMoney, type Lang, type QuoteLine, type QuoteTexts, type Recipient } from "./quote";
import type { QuoteSettings } from "./settings-shared";
import type { CallAnalysis } from "./analysis";

/**
 * Persönliche Texte für Angebot und Mail. Claude schreibt sie aus dem Gespräch (Fireflies), früheren Calls
 * und der bisherigen Kommunikation in GHL. Ziel: Der Interessent merkt, dass wir zugehört haben, ohne
 * Übertreibung und ohne erfundene Fakten.
 */

export const personalizeConfigured = claudeConfigured;

export type QuoteContextInput = {
  number: string;
  language: Lang;
  currency: string;
  recipient: Recipient;
  lines: QuoteLine[];
  validUntil: string;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  analysis: CallAnalysis | null;
  ghlContactId: string | null;
  texts?: QuoteTexts;
  sentAt?: string | null;
};

export type GatheredContext = { text: string; sources: string[] };

/** Sammelt alles, was wir über den Interessenten wissen. Fehlende Quellen werden übersprungen. */
export async function gatherContext(q: QuoteContextInput, opts: { includeTranscript: boolean }): Promise<GatheredContext> {
  const parts: string[] = [];
  const sources: string[] = [];

  if (q.analysis) {
    const a = q.analysis;
    parts.push(
      [
        "## Analyse des Democalls",
        `Zusammenfassung: ${a.summary}`,
        a.needs.length ? `Bedürfnisse: ${a.needs.join("; ")}` : "",
        a.pricingDiscussed ? `Zu Preisen besprochen: ${a.pricingDiscussed}` : "",
        a.nextStep ? `Vereinbarter nächster Schritt: ${a.nextStep}` : "",
        a.onboardingFee ? `Onboarding-Gebühr besprochen: ${a.onboardingFee} ${a.onboardingCurrency ?? ""} ${a.onboardingNote ?? ""}`.trim() : "",
        a.salutation ? `Anrede laut Gespräch: ${a.salutation}` : "",
        a.startDate ? `Gewünschter Start: ${a.startDate}` : "",
        `Anrede im Gespräch: ${a.addressForm === "du" ? "du" : "Sie"}`
      ]
        .filter(Boolean)
        .join("\n")
    );
    sources.push("Call-Analyse");
  }

  if (opts.includeTranscript && q.meetingId && firefliesConfigured()) {
    const t = await getTranscript(q.meetingId).catch(() => null);
    if (t) {
      parts.push(`## Transkript des Democalls „${t.title}“ (${t.dateString ?? ""})\n${transcriptText(t, 60_000)}`);
      sources.push("Transkript");
    }
  }

  const email = q.recipient.email && !isInternalEmail(q.recipient.email) ? q.recipient.email : null;
  if (email && firefliesConfigured()) {
    const earlier = await earlierCalls(email, q.meetingId);
    if (earlier.length) {
      parts.push(
        "## Frühere Calls mit dieser Person\n" +
          earlier.map((c) => `- ${c.dateString?.slice(0, 10) ?? ""} „${c.title}“: ${c.summary}`).join("\n")
      );
      sources.push(`${earlier.length} frühere Calls`);
    }
  }

  if (q.ghlContactId && ghl.ghlConfigured()) {
    const [notes, messages] = await Promise.all([
      ghl.contactNotes(q.ghlContactId).catch(() => []),
      ghl.contactMessages(q.ghlContactId).catch(() => [])
    ]);
    if (notes.length) {
      parts.push("## Notizen im CRM\n" + notes.slice(0, 10).map((n) => `- ${n.at.slice(0, 10)}: ${n.text}`).join("\n"));
      sources.push(`${notes.length} GHL-Notizen`);
    }
    if (messages.length) {
      parts.push(
        "## Bisherige Nachrichten (neueste zuerst)\n" +
          messages
            .slice(0, 20)
            .map((m) => `- ${m.at.slice(0, 10)} ${m.direction === "inbound" ? "vom Kunden" : "von Elev8"} (${m.channel}): ${m.text}`)
            .join("\n")
      );
      sources.push(`${messages.length} GHL-Nachrichten`);
    }
  }

  return { text: parts.join("\n\n"), sources };
}

const ELEV8 = `Elev8 Suite ist eine Software für Ferienwohnungs- und Property-Manager. Wichtige Funktionen:
Kalender/Cockpit über alle Unterkünfte, Reservationen aus Airbnb, Booking.com und direkt, Channel Manager,
digitaler Gästeguide mit Check-in-Anleitung, Smart Locks (Seam), KI-Gästekommunikation (Hostbuddy),
automatische Nachrichten (Dynamic Templates), Upsells für Gäste, Reinigungs- und Aufgabenplanung mit
Checklisten und Zeiterfassung (auch in der App Elev8 Go), IoT-Automationen mit Elev8 Bridge (Shelly),
Auswertungen zu Umsatz, Auslastung und ADR, eigenes Branding und Websites.`;

function assistantLine(settings: QuoteSettings, lang: Lang) {
  const a = settings.assistant;
  if (!a?.whatsapp) return "";
  return lang === "de"
    ? `Erwähne in der Mail kurz, dass ${a.name}, unser Sales-Assistent, Fragen rund um die Uhr per WhatsApp beantwortet (${a.whatsapp}), und dass ${a.name} besonders detailliert Auskunft geben kann, wenn der Kunde von der Nummer schreibt, die er bei der Terminvereinbarung angegeben hat. Höchstens zwei kurze Sätze. Nicht im Angebotstext, das steht bereits im PDF.`
    : `In the email, briefly mention that ${a.name}, our sales assistant, answers questions around the clock on WhatsApp (${a.whatsapp}), and that ${a.name} can answer in particular detail when the customer messages from the number they gave when booking the appointment. Two short sentences at most. Not in the offer text, the PDF already has it.`;
}

function styleRules(lang: Lang, country: string, addressForm: "du" | "sie") {
  const swiss = !["DE", "AT"].includes(country);
  return lang === "de"
    ? `Schreibe auf Deutsch in der ${addressForm === "du" ? "Du-Form (du, dir, dein)" : "Sie-Form (Sie, Ihnen, Ihr)"}.
${swiss ? "Schweizer Rechtschreibung: immer ss statt ß. Grussformel „Freundliche Grüsse“." : "Deutsche Rechtschreibung mit ß. Grussformel „Viele Grüße“ bzw. „Freundliche Grüße“."}`
    : `Write in English. ${addressForm === "du" ? "Friendly, informal tone with first names." : "Polite, professional tone."}`;
}

const COMMON_RULES = `Grundsätze:
- Beziehe dich auf zwei bis drei konkrete Punkte aus dem Gespräch oder der Vorgeschichte (Situation, Problem, Ziel des Kunden, Namen von Häusern oder Tools, die er nennt). So merkt er, dass wir zugehört haben.
- Nicht übertreiben: keine Superlative, keine Floskeln wie „revolutionär“, „perfekte Lösung“, „wir freuen uns riesig“. Ruhig, kompetent, menschlich.
- Erfinde nichts. Nur Fakten aus dem Kontext. Keine Preise, Rabatte oder Termine nennen, die nicht im Kontext stehen.
- Ordne Bedürfnisse nur Elev8-Funktionen zu, die es wirklich gibt (siehe Liste).
- Keine Platzhalter, keine eckigen Klammern, kein Markdown.`;

const quoteTool = {
  name: "write_quote_texts",
  description: "Hält die persönlichen Texte für Angebot und Begleit-Mail fest.",
  input_schema: {
    type: "object",
    properties: {
      addressForm: { type: "string", enum: ["du", "sie"] },
      salutation: {
        type: "string",
        description:
          "Anrede ganz oben im Angebot, ohne Satzzeichen am Ende. Sie-Form: 'Guten Tag Herr Kümin' bzw. 'Guten Tag Frau Meier', wenn das Geschlecht aus dem Gespräch eindeutig ist, sonst 'Guten Tag Rico Kümin'. Du-Form: 'Hallo Rico'. Englisch: 'Dear Rico'."
      },
      intro: {
        type: "string",
        description:
          "Einleitung direkt nach der Anrede, 2 bis 4 Sätze, ohne die Anrede zu wiederholen: Bezug auf das Gespräch und die Situation des Kunden, warum dieses Paket passt."
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description: "3 bis 6 kurze Punkte unter „Aus unserem Gespräch“: was der Kunde braucht und wie Elev8 es löst. Je höchstens 20 Wörter."
      },
      closing: { type: "string", description: "Schluss im Angebot, 1 bis 2 Sätze, mit dem vereinbarten nächsten Schritt, falls bekannt." },
      emailSubject: { type: "string", description: "Betreff der Begleit-Mail, kurz, mit Firmenname des Kunden und Angebotsnummer." },
      emailBody: {
        type: "string",
        description:
          "Begleit-Mail, 60 bis 130 Wörter, Absätze mit Leerzeile. Persönliche Anrede, Bezug aufs Gespräch, Hinweis auf das angehängte Angebot und die Gültigkeit, nächster Schritt, Gruss mit vollem Namen des Absenders."
      }
    },
    required: ["addressForm", "salutation", "intro", "notes", "closing", "emailSubject", "emailBody"]
  }
};

const quoteTextsSchema = z.object({
  addressForm: z.enum(["du", "sie"]),
  salutation: z.string().max(200).default(""),
  intro: z.string().min(1),
  notes: z.array(z.string()).max(8),
  closing: z.string().min(1),
  emailSubject: z.string().min(1).max(250),
  emailBody: z.string().min(1).max(6000)
});

function offerSummary(q: QuoteContextInput, settings: QuoteSettings) {
  const t = computeTotals(q.lines, settings.taxPercent);
  const money = (n: number) => formatMoney(n, q.currency, q.language);
  return [
    `Angebotsnummer: ${q.number}, gültig bis ${formatDate(q.validUntil, q.language)}`,
    ...q.lines.map((l) => `Position: ${l.title} (${l.detail})`),
    t.monthly ? `Pro Monat: ${money(t.monthly)}` : "",
    t.yearly ? `Pro Jahr: ${money(t.yearly)}` : "",
    t.once ? `Einmalig: ${money(t.once)}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function writeQuoteTexts(
  q: QuoteContextInput,
  settings: QuoteSettings,
  sender: { name: string },
  opts: { addressForm?: "du" | "sie"; context?: GatheredContext } = {}
): Promise<{ texts: QuoteTexts; sources: string[] }> {
  const context = opts.context ?? (await gatherContext(q, { includeTranscript: true }));
  const addressForm = opts.addressForm ?? q.analysis?.addressForm ?? q.texts?.addressForm ?? "sie";
  const country = q.recipient.country || "";
  const system = `Du schreibst für Elev8 die persönlichen Texte zu einem Angebot nach einem Gespräch mit einem Interessenten.
${ELEV8}

${COMMON_RULES}
${styleRules(q.language, country, addressForm)}
${assistantLine(settings, q.language)}
Die Mail wird von ${sender.name} gesendet.`;

  const user = `Kunde: ${[q.recipient.company, q.recipient.name].filter(Boolean).join(", ") || "unbekannt"}${
    q.recipient.firstName ? ` (Vorname: ${q.recipient.firstName})` : ""
  }${country ? `, Land: ${country}` : ""}

## Angebot
${offerSummary(q, settings)}

${context.text || "(Kein Gesprächskontext vorhanden. Schreibe dann kurz, sachlich und freundlich, ohne Bezug auf Details.)"}`;

  const input = await callClaudeTool({ system, user, tool: quoteTool, maxTokens: 2500 });
  const r = quoteTextsSchema.parse(input);
  return {
    texts: {
      salutation: r.salutation.trim().replace(/[,.!:]+$/, ""),
      intro: r.intro.trim(),
      notes: r.notes.map((n) => `- ${n.trim()}`).join("\n"),
      closing: r.closing.trim(),
      emailSubject: r.emailSubject.trim(),
      emailBody: r.emailBody.trim(),
      addressForm: opts.addressForm ?? r.addressForm
    },
    sources: context.sources
  };
}

// ── Nachfassen ──────────────────────────────────────────────

const followUpTool = {
  name: "write_follow_up",
  description: "Hält die Nachfass-Mail zu einem versendeten Angebot fest.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Kurzer Betreff, gern als Antwort auf die ursprüngliche Mail (beginnt mit „Re:“ oder „AW:“ nur wenn passend)." },
      body: {
        type: "string",
        description:
          "Nachfass-Mail, 40 bis 100 Wörter. Freundlich, ohne Druck. Bezug auf einen konkreten Punkt aus dem Gespräch, Angebot für offene Fragen, ein konkreter, einfacher nächster Schritt (z.B. kurzer Call). Gruss mit vollem Namen."
      }
    },
    required: ["subject", "body"]
  }
};

export async function writeFollowUp(
  q: QuoteContextInput,
  settings: QuoteSettings,
  sender: { name: string },
  info: { daysSinceSent: number; followUpCount: number }
): Promise<{ subject: string; body: string }> {
  const context = await gatherContext(q, { includeTranscript: false });
  const addressForm = q.texts?.addressForm ?? q.analysis?.addressForm ?? "sie";
  const system = `Du schreibst für Elev8 eine Nachfass-Mail zu einem bereits versendeten Angebot.
${ELEV8}

${COMMON_RULES}
- ${info.followUpCount === 0 ? "Erstes Nachfassen." : `Bereits ${info.followUpCount}x nachgefasst: noch kürzer, und biete an, das Thema später wieder aufzunehmen, falls der Zeitpunkt nicht passt.`}
- Prüfe die bisherigen Nachrichten: Hat der Kunde inzwischen geantwortet, gehe darauf ein statt generisch nachzufragen.
${styleRules(q.language, q.recipient.country || "", addressForm)}
Absender: ${sender.name}.`;
  const user = `Kunde: ${[q.recipient.company, q.recipient.name].filter(Boolean).join(", ")}${
    q.recipient.firstName ? ` (Vorname: ${q.recipient.firstName})` : ""
  }
Angebot versendet vor ${info.daysSinceSent} Tagen. Ursprünglicher Betreff: ${q.texts?.emailSubject || q.number}

## Angebot
${offerSummary(q, settings)}

${context.text}`;
  const input = await callClaudeTool({ system, user, tool: followUpTool, maxTokens: 1200 });
  return z.object({ subject: z.string().min(1).max(250), body: z.string().min(1).max(4000) }).parse(input);
}
