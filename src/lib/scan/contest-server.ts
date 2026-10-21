import { randomInt } from "node:crypto";
import { findLeadByContact, getEvent, setGhlResult, ticketTaken, upsertLead, type MesseEvent, type MesseLead } from "@/lib/messen/store";
import { contestOpen, isQuiz, isUnitRange, normalizeTicket, unitRangeFor, type ContestEntry, type ContestResult } from "./contest";
import type { ScanContact } from "./types";

/**
 * Trägt eine gescannte Teilnahmekarte in den Lostopf einer Messe ein (Tabelle messe_leads, wie das Online-Formular).
 * Ablauf in /api/scan/send: prepareEntry (prüfen, Los bestimmen) → GHL-Upsert des Scanners → commitEntry (Lead anlegen).
 * Danach übernimmt die Messen-Pipeline: GHL-Tags und Notiz (syncLeadToGhl), Bestätigung über Make (notifyMake).
 */

/** Meldung, die so an die Person im Scanner geht */
export class ContestError extends Error {}

// Einstufung wie im öffentlichen Formular (/api/messen/public/leads)
const UNIT_SCORE: Record<string, number> = { "1-4": 1, "5-19": 2, "20-49": 3, "50+": 4 };

/** Teilnahme-Angaben aus dem Browser prüfen; null = keine Teilnahme */
export function sanitizeEntry(raw: unknown): ContestEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const eventId = typeof o.eventId === "string" && /^[0-9a-f-]{36}$/i.test(o.eventId) ? o.eventId : null;
  if (!eventId) return null;
  return {
    eventId,
    quizAnswer: isQuiz(o.quizAnswer) ? o.quizAnswer : null,
    unitRange: isUnitRange(o.unitRange) ? o.unitRange : null,
    consentMarketing: o.consentMarketing === true,
    preferredChannel: o.preferredChannel === "email" ? "email" : "whatsapp",
    ticket: normalizeTicket(o.ticket)
  };
}

async function freeTicket(eventId: string, wanted: string | null): Promise<string> {
  if (wanted && !(await ticketTaken(eventId, wanted))) return wanted;
  for (let i = 0; i < 30; i++) {
    const n = randomInt(100000, 1000000);
    const t = `E8-${String(n).slice(0, 3)} ${String(n).slice(3)}`;
    if (!(await ticketTaken(eventId, t))) return t;
  }
  throw new ContestError("Keine freie Losnummer gefunden – bitte nochmals senden.");
}

export type PreparedEntry = {
  event: MesseEvent;
  /** Schon im Lostopf (online oder früher gescannt): kein zweites Los */
  existing: MesseLead | null;
  ticket: string;
  channel: "whatsapp" | "email";
  whatsapp: string;
  email: string;
  /** Wunsch-Losnummer von der Karte war schon vergeben */
  ticketChanged: boolean;
};

/** Vor dem Schreiben nach GHL: Gewinnspiel offen? Kontaktweg da? Schon im Lostopf? Welche Losnummer? */
export async function prepareEntry(entry: ContestEntry, contact: ScanContact): Promise<PreparedEntry> {
  const event = await getEvent(entry.eventId);
  if (!event) throw new ContestError("Gewinnspiel nicht gefunden.");
  if (!contestOpen(event)) throw new ContestError(`Das Gewinnspiel „${event.name}“ ist geschlossen (Ziehung vorbei oder Seite offline).`);

  const whatsapp = (contact.mobile || contact.phone || "").replace(/[^\d+]/g, "");
  const email = (contact.email ?? "").trim().toLowerCase();
  const waOk = /^\+?\d{8,15}$/.test(whatsapp);
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const channel = entry.preferredChannel === "whatsapp" && waOk ? "whatsapp" : mailOk ? "email" : waOk ? "whatsapp" : null;
  if (!channel) throw new ContestError("Fürs Gewinnspiel braucht es eine Mobilnummer oder eine E-Mail.");

  const existing = await findLeadByContact(event.id, mailOk ? email : "", waOk ? whatsapp : "");
  const ticket = existing?.ticket ?? (await freeTicket(event.id, entry.ticket));
  return {
    event,
    existing,
    ticket,
    channel,
    whatsapp: waOk ? whatsapp : "",
    email: mailOk ? email : "",
    ticketChanged: Boolean(entry.ticket && !existing && ticket !== entry.ticket)
  };
}

/** Nach dem GHL-Upsert: Lead im Lostopf anlegen und mit dem GHL-Kontakt verknüpfen. */
export async function commitEntry(
  p: PreparedEntry,
  entry: ContestEntry,
  contact: ScanContact,
  ghlContactId: string
): Promise<{ result: ContestResult; leadId: string | null }> {
  if (p.existing) return { result: { eventName: p.event.name, ticket: p.existing.ticket, existing: true }, leadId: null };

  const unitRange = entry.unitRange ?? unitRangeFor(contact.units ?? null) ?? "";
  const units = UNIT_SCORE[unitRange] ?? 0;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || p.email || p.whatsapp;
  const lang = contact.language === "de" ? "de" : contact.language ? "en" : p.event.lang;

  let ticket = p.ticket;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await upsertLead({
      eventId: p.event.id,
      ticket,
      name,
      preferredChannel: p.channel,
      whatsapp: p.whatsapp,
      email: p.email,
      units: unitRange,
      airbnbUrl: "",
      airbnbListingId: "",
      airbnbHostId: "",
      company: contact.company ?? "",
      pms: (contact.pms ?? "").slice(0, 60),
      quizAnswer: entry.quizAnswer ?? "",
      quizCorrect: entry.quizAnswer ? entry.quizAnswer === "all" : null,
      score: units,
      tier: !unitRange ? "open" : units >= 3 ? "hot" : units === 2 ? "warm" : "cold",
      consentMarketing: entry.consentMarketing,
      source: "paper_card",
      utm: {},
      lang,
      completed: true,
      submittedAt: new Date(),
      // Ohne Token lässt sich der Lead nicht von aussen überschreiben
      editToken: ""
    });
    if (r) {
      await setGhlResult(r.id, { status: "ok", contactId: ghlContactId });
      return { result: { eventName: p.event.name, ticket, existing: false }, leadId: r.id };
    }
    // Losnummer wurde inzwischen vergeben: neue ziehen
    ticket = await freeTicket(p.event.id, null);
  }
  throw new ContestError("Los konnte nicht gespeichert werden – bitte nochmals senden.");
}
