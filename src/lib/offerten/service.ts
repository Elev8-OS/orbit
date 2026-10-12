import { renderEmail } from "@/lib/mail/layout";
import { mailConfigured, sendMail } from "@/lib/mail/send";
import { analyzeCall, analysisConfigured, type CallAnalysis } from "./analysis";
import { buildDocument, type QuoteDocument } from "./document";
import { getTranscript, internalDomains, isInternalEmail, type Transcript } from "./fireflies";
import * as ghl from "./ghl";
import { renderQuotePdf } from "./pdf";
import {
  EMPTY_RECIPIENT,
  buildLines,
  computeTotals,
  defaultConfig,
  formatMoney,
  type Lang,
  type QuoteConfig,
  type Recipient
} from "./quote";
import { fillTemplate, getSettings, type QuoteSettings } from "./settings";
import {
  claimMeeting,
  createQuote,
  finishMeeting,
  logEvent,
  openQuoteForMeeting,
  saveGhlSync,
  type GhlSyncResult,
  type Quote
} from "./store";
import { renderQuoteXlsx } from "./xlsx";

const orbitUrl = () => process.env.AUTH_URL || "https://myorbit.elev8-suite.com";
export const quoteUrl = (id: string) => `${orbitUrl()}/offerten/${id}`;

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

// ── Vorbefüllen aus GHL und Call ────────────────────────────

type Prefill = {
  recipient: Recipient;
  language: Lang | null;
  units: number | null;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  ghlPipelineId: string | null;
};

const GERMAN = ["german", "swiss german", "deutsch", "schweizerdeutsch"];

export async function prefillFromGhl(contact: ghl.GhlContact): Promise<Prefill> {
  const [preferred, leadUnits, opportunities, pipelineList] = await Promise.all([
    ghl.customValue(contact, "contact.preferred_language").catch(() => undefined),
    ghl.customValue(contact, "contact.lead_einheiten").catch(() => undefined),
    ghl.opportunitiesForContact(contact.id).catch(() => []),
    ghl.pipelines().catch(() => [])
  ]);
  const opp = ghl.pickOpportunity(opportunities);
  const pipelineName = pipelineList.find((p) => p.id === opp?.pipelineId)?.name ?? "";

  let language: Lang | null = null;
  if (typeof preferred === "string" && preferred) language = GERMAN.includes(preferred.toLowerCase()) ? "de" : "en";
  else if (/dach/i.test(pipelineName)) language = "de";
  else if (/bali/i.test(pipelineName)) language = "en";

  const unitsMatch = typeof leadUnits === "string" || typeof leadUnits === "number" ? String(leadUnits).match(/\d+/) : null;

  return {
    recipient: {
      name: contact.name,
      firstName: contact.firstName || contact.name.split(" ")[0] || "",
      email: contact.email,
      company: contact.company,
      addressLines: contact.addressLines,
      phone: contact.phone
    },
    language,
    units: unitsMatch ? Number(unitsMatch[0]) : null,
    ghlContactId: contact.id,
    ghlOpportunityId: opp?.id ?? null,
    ghlPipelineId: opp?.pipelineId ?? null
  };
}

function configFromAnalysis(settings: QuoteSettings, analysis: CallAnalysis | null, units: number | null): QuoteConfig {
  const config = defaultConfig(settings);
  if (units) config.units = units;
  if (!analysis) return config;
  if (analysis.units) config.units = analysis.units;
  if (analysis.model === "per_booking") {
    config.model = "per_booking";
    const pkgs = [...settings.perBooking.packages].sort((a, b) => a.quota - b.quota);
    const yearly = analysis.bookingsPerYear ?? 0;
    config.bookingPackageId = (pkgs.filter((p) => p.quota <= yearly).pop() ?? pkgs[0]).id;
  }
  if (analysis.billing !== "unknown") config.billing = analysis.billing;
  if (analysis.channelManager !== null) config.channelManager = analysis.channelManager;
  if (analysis.wantsCoins) {
    const coins = settings.addons.find((a) => a.id === "coins");
    if (coins) config.addons = [{ id: coins.id, qty: coins.defaultQty }];
  }
  return config;
}

async function findProspect(t: Transcript, analysis: CallAnalysis | null): Promise<ghl.GhlContact | null> {
  if (!ghl.ghlConfigured()) return null;
  const candidates = [
    analysis?.contactEmail?.toLowerCase(),
    ...t.attendees.map((a) => a.email),
    ...t.participants
  ].filter((e): e is string => Boolean(e && e.includes("@") && !isInternalEmail(e)));
  for (const email of [...new Set(candidates)]) {
    const contact = await ghl.findContactByEmail(email).catch((err) => {
      console.error(`GHL-Kontaktsuche für ${email}:`, err);
      return null;
    });
    if (contact) return contact;
  }
  return null;
}

type DraftInput = {
  settings: QuoteSettings;
  transcript: Transcript | null;
  analysis: CallAnalysis | null;
  prefill: Prefill | null;
  owner: { id: string | null; name: string; email: string };
  actor: string;
};

async function createDraft({ settings, transcript, analysis, prefill, owner, actor }: DraftInput): Promise<Quote> {
  const language: Lang = analysis?.language ?? prefill?.language ?? "de";
  const config = configFromAnalysis(settings, analysis, prefill?.units ?? null);
  const external = transcript?.attendees.find((a) => a.email && !isInternalEmail(a.email));
  const recipient: Recipient = prefill?.recipient ?? {
    ...EMPTY_RECIPIENT,
    name: analysis?.contactName ?? external?.name ?? "",
    firstName: (analysis?.contactName ?? external?.name ?? "").split(" ")[0] ?? "",
    email: analysis?.contactEmail ?? external?.email ?? "",
    company: analysis?.company ?? ""
  };
  if (!recipient.company && analysis?.company) recipient.company = analysis.company;

  return createQuote(
    {
      language,
      currency: settings.currency,
      source: transcript ? "fireflies" : "manual",
      meetingId: transcript?.id ?? null,
      meetingTitle: transcript?.title ?? null,
      meetingDate: transcript?.dateString ?? null,
      analysis,
      ghlContactId: prefill?.ghlContactId ?? null,
      ghlOpportunityId: prefill?.ghlOpportunityId ?? null,
      ghlPipelineId: prefill?.ghlPipelineId ?? null,
      recipient,
      config,
      lines: buildLines(config, settings, language),
      texts: {
        intro: settings.texts.intro[language],
        closing: settings.texts.closing[language],
        notes: (analysis?.needs ?? []).map((n) => `- ${n}`).join("\n")
      },
      validUntil: addDays(settings.validityDays),
      ownerId: owner.id,
      ownerName: owner.name,
      ownerEmail: owner.email
    },
    settings.numberPrefix,
    actor
  );
}

// ── Webhook: Call nach Abschluss automatisch prüfen ─────────

/**
 * Wird nach jedem Fireflies-Call aufgerufen. Erstellt einen Entwurf, wenn der Interessent eine Offerte wünscht,
 * und benachrichtigt den Organisator. Versendet nie automatisch.
 */
export async function processMeeting(meetingId: string): Promise<void> {
  if (!(await claimMeeting(meetingId))) return;
  try {
    const transcript = await getTranscript(meetingId);
    if (!transcript) {
      await finishMeeting(meetingId, { status: "error", reason: "Transkript nicht gefunden" });
      return;
    }
    const base = {
      title: transcript.title,
      meetingDate: transcript.dateString,
      organizer: transcript.organizerEmail
    };
    const everyone = [...transcript.participants, ...transcript.attendees.map((a) => a.email ?? "")].filter(Boolean);
    if (!everyone.some((e) => !isInternalEmail(e))) {
      await finishMeeting(meetingId, { ...base, status: "internal", reason: "Nur interne Teilnehmer" });
      return;
    }
    if (!analysisConfigured()) {
      await finishMeeting(meetingId, { ...base, status: "error", reason: "ANTHROPIC_API_KEY fehlt" });
      return;
    }
    const analysis = await analyzeCall(transcript, internalDomains());
    if (!analysis.offerRequested) {
      await finishMeeting(meetingId, { ...base, status: "no_offer", reason: analysis.evidence, analysis });
      return;
    }
    if (analysis.confidence === "low") {
      await finishMeeting(meetingId, { ...base, status: "uncertain", reason: analysis.evidence, analysis });
      return;
    }
    if (await openQuoteForMeeting(meetingId)) {
      await finishMeeting(meetingId, { ...base, status: "quote_created", analysis });
      return;
    }

    const settings = await getSettings();
    const contact = await findProspect(transcript, analysis);
    const prefill = contact ? await prefillFromGhl(contact) : null;
    const ownerEmail = transcript.organizerEmail ?? "";
    const quote = await createDraft({
      settings,
      transcript,
      analysis,
      prefill,
      owner: { id: null, name: ownerEmail ? nameFromEmail(ownerEmail) : "", email: ownerEmail },
      actor: "Fireflies"
    });
    await finishMeeting(meetingId, { ...base, status: "quote_created", reason: analysis.evidence, analysis, quoteId: quote.id });
    await notifyOwner(quote, analysis, Boolean(contact));
  } catch (err) {
    console.error(`Offerten: Call ${meetingId} nicht verarbeitet:`, err);
    await finishMeeting(meetingId, { status: "error", reason: err instanceof Error ? err.message.slice(0, 500) : "Unbekannter Fehler" }).catch(
      () => {}
    );
  }
}

async function notifyOwner(quote: Quote, analysis: CallAnalysis, ghlFound: boolean) {
  const to = quote.ownerEmail;
  if (!to || !mailConfigured() || !isInternalEmail(to)) return;
  const who = quote.recipient.company || quote.recipient.name || quote.recipient.email || "Interessent";
  const { html, text } = renderEmail({
    lang: "de",
    preheader: `Entwurf ${quote.number} für ${who} liegt in Orbit bereit.`,
    heading: `Offerte für ${who} bereit`,
    blocks: [
      { type: "paragraph", text: `Nach dem Call „${quote.meetingTitle ?? "Democall"}“ hat Orbit einen Offertwunsch erkannt und einen Entwurf angelegt. Bitte prüfen, anpassen und versenden.` },
      { type: "quote", text: analysis.evidence },
      {
        type: "details",
        rows: [
          ["Offerte", quote.number],
          ["Empfänger", [quote.recipient.name, quote.recipient.email].filter(Boolean).join(", ") || "noch offen"],
          ["GHL-Kontakt", ghlFound ? "gefunden und verknüpft" : "nicht gefunden, bitte im Entwurf zuordnen"]
        ]
      }
    ],
    cta: { label: "Entwurf öffnen", url: quoteUrl(quote.id) },
    footer: "Diese E-Mail wurde von der Offerten-App in Orbit gesendet."
  });
  await sendMail({ to, subject: `Offerte bereit: ${who} (${quote.number})`, html, text, tags: [{ name: "type", value: "quote_draft" }] });
}

// ── Manuell starten ─────────────────────────────────────────

export type Starter = { id: string; name: string; email: string };

export async function createFromMeeting(meetingId: string, user: Starter): Promise<Quote> {
  const existing = await openQuoteForMeeting(meetingId);
  if (existing) throw Object.assign(new Error("already_exists"), { quoteId: existing });
  const transcript = await getTranscript(meetingId);
  if (!transcript) throw new Error("transcript_not_found");
  const analysis = analysisConfigured() ? await analyzeCall(transcript, internalDomains()).catch(() => null) : null;
  const settings = await getSettings();
  const contact = await findProspect(transcript, analysis);
  const prefill = contact ? await prefillFromGhl(contact) : null;
  const quote = await createDraft({ settings, transcript, analysis, prefill, owner: user, actor: user.name });
  await finishMeeting(meetingId, {
    status: "quote_created",
    title: transcript.title,
    meetingDate: transcript.dateString,
    organizer: transcript.organizerEmail,
    analysis,
    quoteId: quote.id
  });
  return quote;
}

export async function createBlank(user: Starter, ghlContactId?: string | null): Promise<Quote> {
  const settings = await getSettings();
  const contact = ghlContactId && ghl.ghlConfigured() ? await ghl.getContact(ghlContactId) : null;
  const prefill = contact ? await prefillFromGhl(contact) : null;
  return createDraft({ settings, transcript: null, analysis: null, prefill, owner: user, actor: user.name });
}

// ── Dateien ─────────────────────────────────────────────────

export type Format = "pdf" | "xlsx";

export const MIME: Record<Format, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

/** Versendete Offerten zeigen den Absender als Kontakt, Entwürfe den Eigentümer. */
export function documentFor(quote: Quote, settings: QuoteSettings): QuoteDocument {
  if (quote.status === "sent" && quote.sentByEmail) {
    return buildDocument({ ...quote, ownerName: quote.sentByName, ownerEmail: quote.sentByEmail }, settings);
  }
  return buildDocument(quote, settings);
}

export async function renderFile(doc: QuoteDocument, format: Format): Promise<{ filename: string; data: Buffer; type: string }> {
  const data = format === "pdf" ? await renderQuotePdf(doc) : await renderQuoteXlsx(doc);
  return { filename: `${doc.fileBase}.${format}`, data, type: MIME[format] };
}

export function defaultEmail(quote: Quote, settings: QuoteSettings, senderName: string) {
  const lang = quote.language;
  const doc = buildDocument(quote, settings);
  const values = {
    number: quote.number,
    validUntil: doc.validUntilText,
    firstName: quote.recipient.firstName || quote.recipient.name || (lang === "de" ? "zusammen" : "there"),
    company: quote.recipient.company,
    senderName
  };
  return {
    subject: fillTemplate(settings.texts.emailSubject[lang], values),
    body: fillTemplate(settings.texts.emailBody[lang], values)
  };
}

// ── Ablage in GHL ───────────────────────────────────────────

const STAGE_NAME = () => (process.env.GHL_PROPOSAL_STAGE_NAME || "Proposal / Contract Sent").toLowerCase();

export async function syncToGhl(
  quote: Quote,
  files: { filename: string; data: Buffer; type: string }[],
  settings: QuoteSettings,
  senderName: string
): Promise<GhlSyncResult> {
  const result: GhlSyncResult = { at: new Date().toISOString() };
  if (!ghl.ghlConfigured() || !quote.ghlContactId) {
    result.note = { ok: false, error: quote.ghlContactId ? "GHL nicht konfiguriert" : "Kein GHL-Kontakt zugeordnet" };
    await saveGhlSync(quote.id, result);
    return result;
  }

  // 1. Dateien ablegen: bevorzugt im Datei-Feld des Kontakts, sonst in der Mediathek
  const urls: { name: string; url: string }[] = [];
  const fieldKey = process.env.GHL_QUOTE_FILE_FIELD_KEY;
  for (const file of files) {
    const upload = { name: file.filename, data: file.data, type: file.type };
    try {
      let url: string | null = null;
      let target: "contact_field" | "media" = "media";
      if (fieldKey) {
        url = await ghl.uploadToContactField(quote.ghlContactId, fieldKey, upload).catch((err) => {
          console.error("GHL-Datei-Feld:", err);
          return null;
        });
        if (url !== null) target = "contact_field";
      }
      if (url === null || url === "") url = await ghl.uploadToMedia(upload);
      urls.push({ name: file.filename, url });
      result.file = { ok: true, url, target };
    } catch (err) {
      result.file = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 2. Notiz mit Eckdaten und Links
  const totals = computeTotals(quote.lines, settings.taxPercent);
  const money = (n: number) => formatMoney(n, quote.currency, quote.language);
  const parts = [
    `Offerte ${quote.number} versendet von ${senderName} an ${(quote.sentTo ?? [quote.recipient.email]).join(", ")}.`,
    ...quote.lines.map((l) => `• ${l.title}`),
    totals.monthly ? `Pro Monat: ${money(totals.monthly)}` : "",
    totals.yearly ? `Pro Jahr: ${money(totals.yearly)}` : "",
    totals.once ? `Einmalig: ${money(totals.once)}` : "",
    `Total im ersten Jahr: ${money(totals.firstYear)}`,
    `Gültig bis: ${quote.validUntil}`,
    ...urls.map((u) => `${u.name}: ${u.url}`),
    `In Orbit: ${quoteUrl(quote.id)}`
  ].filter(Boolean);
  try {
    await ghl.addNote(quote.ghlContactId, parts.join("\n"));
    result.note = { ok: true };
  } catch (err) {
    result.note = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 3. Opportunity auf "Proposal / Contract Sent" und Wert = Total erstes Jahr
  if (!quote.ghlOpportunityId) {
    result.opportunity = { ok: false, skipped: "Keine Opportunity verknüpft" };
  } else {
    try {
      const list = await ghl.pipelines();
      const pipeline = list.find((p) => p.id === quote.ghlPipelineId);
      const stage = pipeline?.stages.find((s) => s.name.toLowerCase() === STAGE_NAME());
      const body: { pipelineStageId?: string; monetaryValue?: number } = {};
      if (stage) body.pipelineStageId = stage.id;
      if (process.env.GHL_SET_OPPORTUNITY_VALUE !== "false") body.monetaryValue = totals.firstYear;
      if (Object.keys(body).length) await ghl.updateOpportunity(quote.ghlOpportunityId, body);
      result.opportunity = stage
        ? { ok: true, stage: stage.name }
        : { ok: true, skipped: `Stufe „${process.env.GHL_PROPOSAL_STAGE_NAME || "Proposal / Contract Sent"}“ nicht in der Pipeline gefunden` };
    } catch (err) {
      result.opportunity = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  await saveGhlSync(quote.id, result);
  await logEvent(quote.id, senderName, "ghl_sync", result);
  return result;
}
