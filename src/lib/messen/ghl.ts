import { ghlConfigured } from "@/lib/offerten/ghl";
import type { MesseEvent, MesseLead } from "./store";
import { getEvent, getLead, setGhlResult } from "./store";

/**
 * Überträgt einen Messe-Lead nach GoHighLevel. Nach dem ersten Schritt: Kontakt anlegen oder ergänzen
 * (Upsert über E-Mail/Telefon) mit Tags und Notiz. Bei jeder Ergänzung: neue Tags dazu, und sobald alle
 * Schritte durch sind, eine Notiz mit allen Angaben. Nutzt GHL_API_TOKEN und GHL_LOCATION_ID wie Offerten.
 * Nötige Scopes zusätzlich zu den Offerten-Scopes: keine (contacts.write ist schon nötig).
 */

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

async function ghl<T>(path: string, body: unknown, method: "POST" | "PUT" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (json as { message?: string | string[] } | null)?.message;
    throw new Error(`GHL ${res.status}: ${Array.isArray(message) ? message.join("; ") : message ?? text.slice(0, 200)}`);
  }
  return json as T;
}

const tagSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9+-]+/g, "-").replace(/^-+|-+$/g, "");

export function leadTags(event: MesseEvent, lead: MesseLead): string[] {
  const tags = [
    "messe-lead",
    `messe-${tagSafe(event.slug)}`,
    lead.units ? `tier-${lead.tier}` : "",
    lead.units ? `units-${tagSafe(lead.units)}` : "",
    `kanal-${lead.preferredChannel}`,
    lead.airbnbUrl ? "airbnb-link" : "",
    lead.consentMarketing ? "retargeting-ok" : "",
    lead.completed ? "" : "messe-unvollstaendig",
    lead.pms ? `pms-${tagSafe(lead.pms)}` : "",
    ...event.ghlTags
  ];
  return [...new Set(tags.filter(Boolean))];
}

const UNITS_LABEL: Record<string, string> = { "1-4": "1–4", "5-19": "5–19", "20-49": "20–49", "50+": "50+", none: "vermietet nicht" };

function noteBody(event: MesseEvent, lead: MesseLead): string {
  return [
    lead.completed ? `Messe-Lead: ${event.name}` : `Messe-Lead (Kontakt, Angaben folgen): ${event.name}`,
    `Losnummer: ${lead.ticket}`,
    lead.company ? `Firma: ${lead.company}` : "",
    `Units: ${UNITS_LABEL[lead.units] ?? (lead.units || "–")}`,
    lead.pms ? `PMS: ${lead.pms}` : "",
    lead.quizCorrect === null ? "" : `Quiz: ${lead.quizCorrect ? "richtig" : `falsch (${lead.quizAnswer})`}`,
    `Einstufung: ${lead.tier}`,
    `Kontakt bevorzugt: ${lead.preferredChannel === "whatsapp" ? "WhatsApp" : "E-Mail"}`,
    lead.airbnbUrl ? `Airbnb: ${lead.airbnbUrl}` : "Airbnb: kein Link",
    `Werbung/Updates erlaubt: ${lead.consentMarketing ? "ja" : "nein"}`,
    `Quelle: ${lead.source === "booth_tablet" ? "Tablet am Stand" : "QR-Code"}`
  ].filter(Boolean).join("\n");
}

export async function syncLeadToGhl(leadId: string): Promise<void> {
  const lead = await getLead(leadId);
  if (!lead) return;
  if (!ghlConfigured()) {
    await setGhlResult(leadId, { status: "skipped", error: "GHL_API_TOKEN oder GHL_LOCATION_ID fehlt" });
    return;
  }
  const event = await getEvent(lead.eventId);
  if (!event) return;
  try {
    // Schon in GHL: nur Tags ergänzen, am Ende eine Notiz mit allen Angaben
    if (lead.ghlContactId) {
      await ghl(`/contacts/${encodeURIComponent(lead.ghlContactId)}/tags`, { tags: leadTags(event, lead) });
      if (lead.completed) {
        await ghl(`/contacts/${encodeURIComponent(lead.ghlContactId)}/tags`, { tags: ["messe-unvollstaendig"] }, "DELETE");
        if (lead.company) await ghl(`/contacts/${encodeURIComponent(lead.ghlContactId)}`, { companyName: lead.company }, "PUT");
        await ghl(`/contacts/${encodeURIComponent(lead.ghlContactId)}/notes`, { body: noteBody(event, lead) });
      }
      await setGhlResult(leadId, { status: "ok", contactId: lead.ghlContactId });
      return;
    }
    const [firstName, ...rest] = lead.name.trim().split(/\s+/);
    const upsert = await ghl<{ contact?: { id: string } }>("/contacts/upsert", {
      locationId: process.env.GHL_LOCATION_ID,
      firstName,
      lastName: rest.join(" ") || undefined,
      name: lead.name,
      companyName: lead.company || undefined,
      email: lead.email || undefined,
      phone: lead.whatsapp || undefined,
      source: `Messe: ${event.name}`,
      tags: leadTags(event, lead)
    });
    const contactId = upsert.contact?.id;
    if (!contactId) throw new Error("GHL hat keine Kontakt-ID geliefert");
    await ghl(`/contacts/${encodeURIComponent(contactId)}/notes`, { body: noteBody(event, lead) });
    await setGhlResult(leadId, { status: "ok", contactId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Messe-Lead ${leadId} → GHL:`, msg);
    await setGhlResult(leadId, { status: "error", error: msg.slice(0, 500) });
  }
}
