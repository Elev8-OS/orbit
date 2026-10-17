import { getEvent, getLead } from "./store";
import { publicUrl } from "./urls";

/**
 * Meldet Messe-Leads an Make (MESSEN_WEBHOOK_URL). Make verschickt damit die Bestätigung, reichert den
 * Airbnb-Link an und fasst bei Abbrüchen nach. Ohne Variable passiert nichts.
 *  lead.created   – direkt nach Schritt 1 (Kontakt), Lead ist im Lostopf
 *  lead.completed – Units und gegebenenfalls Airbnb-Link sind da (einmal pro Lead)
 */
export type MesseWebhookEvent = "lead.created" | "lead.completed";

const UNITS_LABEL: Record<string, string> = { "1-4": "1–4", "5-19": "5–19", "20-49": "20–49", "50+": "50+", none: "" };

export async function notifyMake(leadId: string, events: MesseWebhookEvent[]): Promise<void> {
  const url = process.env.MESSEN_WEBHOOK_URL;
  if (!url || !events.length) return;
  const lead = await getLead(leadId);
  if (!lead) return;
  const event = await getEvent(lead.eventId);
  if (!event) return;

  const locale = lead.lang === "en" ? "en-GB" : "de-DE";
  const drawText = event.drawAt
    ? event.drawAt.toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: event.timeZone })
    : event.datesLabel;
  const data = {
    lead: {
      id: lead.id,
      ticket: lead.ticket,
      name: lead.name,
      first_name: lead.name.trim().split(/\s+/)[0] ?? "",
      channel: lead.preferredChannel,
      whatsapp: lead.whatsapp,
      email: lead.email,
      units: lead.units,
      units_label: UNITS_LABEL[lead.units] ?? "",
      tier: lead.tier,
      airbnb_url: lead.airbnbUrl,
      airbnb_listing_id: lead.airbnbListingId,
      airbnb_host_id: lead.airbnbHostId,
      consent_marketing: lead.consentMarketing,
      completed: lead.completed,
      lang: lead.lang === "en" ? "en" : "de",
      source: lead.source,
      ghl_contact_id: lead.ghlContactId ?? "",
      created_at: lead.createdAt.toISOString()
    },
    messe: {
      slug: event.slug,
      name: event.name,
      booth: event.booth,
      dates: event.datesLabel,
      prize_title: event.prizeTitle,
      prize_detail: event.prizeDetail,
      draw_at: event.drawAt ? event.drawAt.toISOString() : "",
      draw_text: drawText,
      time_zone: event.timeZone,
      demo_url: event.demoUrl,
      page_url: event.websiteUrl || publicUrl(event.slug)
    }
  };

  for (const name of events) {
    const body = JSON.stringify({ event: name, sent_at: new Date().toISOString(), ...data });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(10_000) });
        if (res.ok) break;
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempt === 2) console.error(`Messe-Lead ${leadId} → Make (${name}):`, err instanceof Error ? err.message : err);
      }
    }
  }
}
