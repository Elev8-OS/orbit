import { addGhlNote, setGhlFields, type GhlFieldDef } from "./ghl";
import { getLead } from "./store";

/**
 * Reichert fertige Messe-Leads mit Airbnb-Link über AirROI an (AIRROI_API_KEY, wie im Portfolio-Modul) und
 * legt das Ergebnis als Notiz am GHL-Kontakt ab: Inserat, Bewertung, Umsatz und Auslastung sowie die Zahl der
 * Inserate desselben Hosts im Land. Die wichtigsten Werte kommen zusätzlich in eigene Kontakt-Felder (FIELDS),
 * damit sich in GHL danach filtern lässt. Ohne Schlüssel, Inserat-ID oder GHL-Kontakt passiert nichts.
 */

const FIELDS = {
  hostListings: { name: "AirROI Host Listings", dataType: "NUMERICAL" },
  revenue: { name: "AirROI Revenue 12M USD", dataType: "NUMERICAL" },
  occupancy: { name: "AirROI Occupancy 12M Percent", dataType: "NUMERICAL" },
  adr: { name: "AirROI ADR USD", dataType: "NUMERICAL" },
  rating: { name: "AirROI Rating", dataType: "NUMERICAL" },
  location: { name: "AirROI Location", dataType: "TEXT" }
} satisfies Record<string, GhlFieldDef>;

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const base = () => (process.env.AIRROI_BASE_URL || "https://api.airroi.com").replace(/\/+$/, "");

async function airroi(path: string, init: { method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown } = {}) {
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : "";
  const res = await fetch(`${base()}${path}${qs}`, {
    method: init.method ?? "GET",
    headers: { "x-api-key": process.env.AIRROI_API_KEY ?? "", Accept: "application/json", "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AirROI ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const n0 = (v: unknown) => (typeof v === "number" ? new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(v) : "–");
const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)} %` : "–");

export async function enrichLeadWithAirroi(leadId: string): Promise<void> {
  if (!process.env.AIRROI_API_KEY) return;
  const lead = await getLead(leadId);
  if (!lead || !lead.airbnbListingId || !lead.ghlContactId) return;
  try {
    // Die Inserat-ID als Text übergeben: als Zahl verliert sie Stellen
    const l = await airroi("/listings", { query: { id: lead.airbnbListingId, currency: "usd" } });
    const info = l.listing_info ?? {}, host = l.host_info ?? {}, loc = l.location_info ?? {};
    const det = l.property_details ?? {}, rat = l.ratings ?? {}, perf = l.performance_metrics ?? {};

    let hostListings: number | null = null;
    if (host.host_id && loc.country) {
      try {
        const s = await airroi("/listings/search/market", {
          method: "POST",
          body: { market: { country: loc.country }, filter: { host_id: { eq: host.host_id } }, pagination: { offset: 0, page_size: 1 }, currency: "usd" }
        });
        hostListings = typeof s.pagination?.total_count === "number" ? s.pagination.total_count : null;
      } catch (err) {
        console.warn(`Messe-Lead ${leadId} → AirROI Host-Inserate:`, err instanceof Error ? err.message : err);
      }
    }

    const body = [
      `AirROI zum Airbnb-Inserat (Messe-Lead ${lead.ticket})`,
      `Inserat: ${info.listing_name ?? "–"} (${info.listing_type ?? "–"})`,
      `Ort: ${[loc.locality, loc.region, loc.country].filter(Boolean).join(", ") || "–"}`,
      `Gäste / Schlafzimmer: ${det.guests ?? "–"} / ${det.bedrooms ?? "–"}`,
      `Bewertung: ${rat.rating_overall ?? "–"} (${rat.num_reviews ?? 0} Bewertungen)`,
      `Letzte 12 Monate: Umsatz USD ${n0(perf.ttm_revenue)}, Auslastung ${pct(perf.ttm_occupancy)}, Ø Preis USD ${n0(perf.ttm_avg_rate)}`,
      `Letzte 90 Tage: Umsatz USD ${n0(perf.l90d_revenue)}, Auslastung ${pct(perf.l90d_occupancy)}`,
      `Host: ${host.host_name ?? "–"}${host.superhost ? ", Superhost" : ""}${host.professional_management ? ", nutzt PMS/Channel Manager" : ""}`,
      hostListings !== null ? `Inserate dieses Hosts in ${loc.country}: ${hostListings}` : "",
      lead.airbnbUrl
    ].filter(Boolean).join("\n");
    await addGhlNote(lead.ghlContactId, body);

    try {
      const occ = numOrNull(perf.ttm_occupancy);
      const rev = numOrNull(perf.ttm_revenue), adr = numOrNull(perf.ttm_avg_rate);
      await setGhlFields(lead.ghlContactId, [
        { def: FIELDS.hostListings, value: hostListings },
        { def: FIELDS.revenue, value: rev === null ? null : Math.round(rev) },
        { def: FIELDS.occupancy, value: occ === null ? null : Math.round(occ * 100) },
        { def: FIELDS.adr, value: adr === null ? null : Math.round(adr) },
        { def: FIELDS.rating, value: numOrNull(rat.rating_overall) },
        { def: FIELDS.location, value: [loc.locality, loc.country].filter(Boolean).join(", ") || null }
      ]);
    } catch (err) {
      console.warn(`Messe-Lead ${leadId} → AirROI-Felder in GHL:`, err instanceof Error ? err.message : err);
    }
  } catch (err) {
    console.error(`Messe-Lead ${leadId} → AirROI:`, err instanceof Error ? err.message : err);
  }
}
