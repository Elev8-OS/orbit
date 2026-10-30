import { renderEmail } from "@/lib/mail/layout";
import { sendMail } from "@/lib/mail/send";
import * as ghl from "./ghl";
import { onboardingUrl } from "./links";
import { createOnboarding, type Onboarding } from "./onboarding";
import { computeTotals, formatDate, formatMoney } from "./quote";
import { getSettings } from "./settings";
import { getQuoteByAcceptToken, logEvent, markAccepted, type Acceptance, type Quote } from "./store";

/**
 * Annahme einer Offerte durch den Kunden (öffentliche Seite /angebot/<token>):
 * 1. Offerte genau einmal auf angenommen und gewonnen setzen, Nachweis speichern
 * 2. Onboarding-Checkliste anlegen
 * 3. GHL: Opportunity gewonnen, Notiz mit allen Angaben, Tag "onboarding-start" (löst eigene Workflows aus)
 * 4. Mails: Bestätigung mit Onboarding-Link an den Kunden, Info an die zuständige Sales-Person
 * Schritte 3 und 4 dürfen scheitern, ohne die Annahme rückgängig zu machen; Fehler landen im Verlauf.
 */

export type AcceptInput = Omit<Acceptance, "ip" | "userAgent" | "at" | "termsAccepted">;

export type AcceptError = "not_found" | "already_accepted" | "closed" | "expired";

export const ONBOARDING_TAG = "onboarding-start";

const today = () => new Date().toISOString().slice(0, 10);

/** Ob und warum eine Offerte (noch) nicht angenommen werden kann */
export function acceptState(q: Quote | null): "open" | AcceptError {
  if (!q || q.status !== "sent") return "not_found";
  if (q.acceptedAt) return "already_accepted";
  if (q.outcome !== "open") return "closed";
  if (q.validUntil < today()) return "expired";
  return "open";
}

export async function acceptQuote(
  token: string,
  input: AcceptInput,
  meta: { ip: string | null; userAgent: string | null }
): Promise<{ ok: true; quote: Quote; onboarding: Onboarding } | { ok: false; error: AcceptError }> {
  const current = await getQuoteByAcceptToken(token);
  const state = acceptState(current);
  if (state !== "open") return { ok: false, error: state };

  const acceptance: Acceptance = { ...input, termsAccepted: true, ip: meta.ip, userAgent: meta.userAgent, at: new Date().toISOString() };
  const quote = await markAccepted(token, acceptance);
  if (!quote) return { ok: false, error: "already_accepted" };

  const settings = await getSettings();
  const onboarding = await createOnboarding(quote, settings);
  await logEvent(quote.id, input.name, "accepted", { company: input.company, email: input.email, ip: meta.ip });

  const results = await Promise.allSettled([syncAcceptanceToGhl(quote, onboarding), notifyOwner(quote, onboarding), confirmToCustomer(quote, onboarding)]);
  const [ghlResult, ownerMail, customerMail] = results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: String(r.reason) }));
  await logEvent(quote.id, "Orbit", "accept_followups", { ghl: ghlResult, ownerMail, customerMail });
  return { ok: true, quote, onboarding };
}

// ── GHL ──────────────────────────────────────────────────────────────

async function syncAcceptanceToGhl(q: Quote, onboarding: Onboarding): Promise<Record<string, unknown>> {
  if (!ghl.ghlConfigured() || !q.ghlContactId) return { ok: false, skipped: "Kein GHL-Kontakt verknüpft" };
  const a = q.acceptance!;
  const totals = computeTotals(q.lines, 0);
  const steps: Record<string, unknown> = {};
  const note = [
    `Offerte ${q.number} online angenommen von ${a.name}${a.role ? ` (${a.role})` : ""}, ${a.email}.`,
    a.company ? `Firma: ${a.company}` : "",
    a.addressLines.length ? `Rechnungsadresse: ${a.addressLines.join(", ")}${a.country ? `, ${a.country}` : ""}` : "",
    a.vatId ? `USt-IdNr./UID: ${a.vatId}` : "",
    a.note ? `Bemerkung: ${a.note}` : "",
    ...q.lines.map((l) => `• ${l.title}`),
    `Total im ersten Jahr: ${formatMoney(totals.firstYear, q.currency, q.language)} exkl. MwSt.`,
    `Onboarding-Checkliste (Kunde): ${onboardingUrl(onboarding.token)}`
  ]
    .filter(Boolean)
    .join("\n");
  try {
    await ghl.addNote(q.ghlContactId, note);
    steps.note = true;
  } catch (err) {
    steps.note = String(err);
  }
  try {
    await ghl.addTags(q.ghlContactId, [ONBOARDING_TAG]);
    steps.tag = true;
  } catch (err) {
    steps.tag = String(err);
  }
  if (q.ghlOpportunityId) {
    try {
      await ghl.updateOpportunityStatus(q.ghlOpportunityId, "won");
      steps.opportunity = "won";
    } catch (err) {
      steps.opportunity = String(err);
    }
  }
  return { ok: Object.values(steps).every((v) => v === true || v === "won"), ...steps };
}

// ── Mails ────────────────────────────────────────────────────────────

const orbitUrl = () => (process.env.AUTH_URL || "https://myorbit.elev8-suite.com").replace(/\/+$/, "");

async function notifyOwner(q: Quote, onboarding: Onboarding): Promise<Record<string, unknown>> {
  const to = q.sentByEmail || q.contactPerson?.email || q.ownerEmail;
  if (!to) return { ok: false, skipped: "Keine Sales-Person bekannt" };
  const a = q.acceptance!;
  const who = a.company || q.recipient.company || a.name;
  const totals = computeTotals(q.lines, 0);
  const { html, text } = renderEmail({
    lang: "de",
    preheader: `${who} hat die Offerte ${q.number} angenommen.`,
    heading: `${who} hat angenommen`,
    blocks: [
      { type: "paragraph", text: `Die Offerte ${q.number} wurde soeben online angenommen. Die Onboarding-Checkliste ist angelegt, in GHL ist die Opportunity gewonnen und der Tag „${ONBOARDING_TAG}“ gesetzt.` },
      {
        type: "details",
        rows: [
          ["Angenommen von", [a.name, a.role].filter(Boolean).join(", ")],
          ["E-Mail", a.email],
          ["Firma", a.company || "–"],
          ["Rechnungsadresse", [...a.addressLines, a.country].filter(Boolean).join(", ") || "–"],
          ...(a.vatId ? ([["USt-IdNr./UID", a.vatId]] as [string, string][]) : []),
          ["Total im ersten Jahr", `${formatMoney(totals.firstYear, q.currency, q.language)} exkl. MwSt.`],
          ...(a.note ? ([["Bemerkung", a.note]] as [string, string][]) : [])
        ]
      }
    ],
    cta: { label: "Onboarding öffnen", url: `${orbitUrl()}/offerten/onboarding/${onboarding.id}` },
    footer: "Diese E-Mail wurde von der Offerten-App in Orbit gesendet."
  });
  const res = await sendMail({ to, subject: `Angenommen: ${who} (${q.number})`, html, text, tags: [{ name: "type", value: "quote_accepted" }] });
  return res.ok ? { ok: true } : { ok: false, error: res.reason };
}

const CUSTOMER = {
  de: {
    sie: {
      subject: (n: string) => `Vielen Dank – Ihr Angebot ${n} ist angenommen`,
      heading: "Willkommen bei Elev8",
      intro: (name: string) => `Guten Tag ${name}`,
      body: "Vielen Dank für Ihr Vertrauen. Wir haben Ihre Annahme erhalten und starten jetzt mit dem Onboarding. Auf Ihrer Onboarding-Seite sehen Sie alle Schritte bis zum Go-live, was Sie erledigen und was wir für Sie übernehmen.",
      first: "Als Erstes buchen Sie dort den Kick-off-Call.",
      cta: "Onboarding öffnen",
      noah: (n: string, p: string) => `Fragen? ${n}, unser Sales-Assistent, ist rund um die Uhr per WhatsApp erreichbar: ${p}`
    },
    du: {
      subject: (n: string) => `Vielen Dank – dein Angebot ${n} ist angenommen`,
      heading: "Willkommen bei Elev8",
      intro: (name: string) => `Hallo ${name}`,
      body: "Vielen Dank für dein Vertrauen. Wir haben deine Annahme erhalten und starten jetzt mit dem Onboarding. Auf deiner Onboarding-Seite siehst du alle Schritte bis zum Go-live, was du erledigst und was wir für dich übernehmen.",
      first: "Als Erstes buchst du dort den Kick-off-Call.",
      cta: "Onboarding öffnen",
      noah: (n: string, p: string) => `Fragen? ${n}, unser Sales-Assistent, ist rund um die Uhr per WhatsApp erreichbar: ${p}`
    }
  },
  en: {
    sie: {
      subject: (n: string) => `Thank you – your offer ${n} is accepted`,
      heading: "Welcome to Elev8",
      intro: (name: string) => `Dear ${name},`,
      body: "Thank you for your trust. We have received your acceptance and are starting your onboarding now. Your onboarding page shows every step until go-live: what you do and what we take care of for you.",
      first: "First, please book the kick-off call there.",
      cta: "Open onboarding",
      noah: (n: string, p: string) => `Questions? ${n}, our sales assistant, is available around the clock on WhatsApp: ${p}`
    }
  }
} as const;

async function confirmToCustomer(q: Quote, onboarding: Onboarding): Promise<Record<string, unknown>> {
  const a = q.acceptance!;
  const settings = await getSettings();
  const lang = q.language === "en" ? "en" : "de";
  const tx = lang === "en" ? CUSTOMER.en.sie : CUSTOMER.de[q.texts.addressForm === "du" ? "du" : "sie"];
  const firstName = q.texts.addressForm === "du" ? (q.recipient.firstName || a.name.split(" ")[0]) : a.name;
  const assistant = settings.assistant?.whatsapp ? tx.noah(settings.assistant.name || "Noah", settings.assistant.whatsapp) : "";
  const { html, text } = renderEmail({
    lang,
    preheader: tx.subject(q.number),
    heading: tx.heading,
    blocks: [
      { type: "paragraph", text: tx.intro(firstName) },
      { type: "paragraph", text: tx.body },
      { type: "paragraph", text: tx.first },
      ...(assistant ? ([{ type: "paragraph", text: assistant }] as const) : [])
    ],
    cta: { label: tx.cta, url: onboardingUrl(onboarding.token) },
    footer: `${settings.issuer.company} · ${formatDate(new Date(), lang)}`
  });
  const replyTo = q.sentByEmail || q.contactPerson?.email || undefined;
  const res = await sendMail({ to: a.email, subject: tx.subject(q.number), html, text, replyTo, tags: [{ name: "type", value: "quote_accepted_customer" }] });
  return res.ok ? { ok: true } : { ok: false, error: res.reason };
}
