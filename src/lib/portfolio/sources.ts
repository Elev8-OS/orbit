import { sql } from "@/lib/db";
import { mcpCallTool } from "@/lib/portfolio/mcp";
import { mdvConnected, mdvRunSql } from "@/lib/portfolio/mdvOauth";
import properties from "@/lib/portfolio/data/properties.json";
import issues from "@/lib/portfolio/data/issues.json";
import markets from "@/lib/portfolio/data/markets.json";
import marketTrend from "@/lib/portfolio/data/market_trend_sh.json";
import pricelabsMonthsStatic from "@/lib/portfolio/data/pricelabs_months.json";
import {
  airroiConfigured,
  classifyIssues,
  fetchAirroiMarkets,
  fetchAirroiTrendSh,
  fetchHostbuddy,
  fetchPricelabs,
  hostbuddyConfigured,
  notesFromFeedback,
  pricelabsConfigured,
  pricelabsMonths,
  type RawIssue
} from "@/lib/portfolio/live";

/**
 * Datenquellen des Portfolio-Moduls. Live-Daten werden serverseitig mit den Zugängen aus Railway geholt
 * und in portfolio_cache zwischengespeichert (Standard 60 Minuten, PORTFOLIO_CACHE_MINUTES):
 * - Elev8 Suite (MCP): ELEV8_MCP_URL, ELEV8_MCP_TOKEN – Reservierungen und Kanal-Kennzahlen
 * - MyDataValue: bevorzugt Orbits eigene Anmeldung beim offiziellen Server (mdvOauth.ts, „myDataValue verbinden“),
 *   sonst der Dienst mydatavalue-mcp (MDV_MCP_URL, MDV_MCP_TOKEN) – Booking-Bewertungen
 * - AirROI, PriceLabs, HostBuddy und Elev8-Kalendernotizen: siehe live.ts
 * Fehlt eine Quelle, gilt der feste Stand aus data/*.json (15.10.2026). Neubeurteilungen aus portfolio_docs überschreiben die Empfehlungen.
 */

const CACHE_MINUTES = () => Number(process.env.PORTFOLIO_CACHE_MINUTES || 60);
const RES_FROM = () => process.env.PORTFOLIO_RES_FROM || "2024-10-01";
const RES_TO = () => process.env.PORTFOLIO_RES_TO || "2027-12-31";
const TAG = () => process.env.PORTFOLIO_LISTING_TAG || "Swiss";

export const elev8Configured = () => Boolean(process.env.ELEV8_MCP_TOKEN);
export const mdvProxyConfigured = () => Boolean(process.env.MDV_MCP_URL && process.env.MDV_MCP_TOKEN);

const KEEP = ["listing_name", "channel", "status", "check_in_date", "check_out_date", "booked_at", "nights", "number_of_guests", "number_of_adults", "number_of_childrens", "currency", "total_amount", "rating"] as const;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const p = payload as { results?: unknown; data?: unknown } | null;
  if (p && Array.isArray(p.results)) return p.results as Record<string, unknown>[];
  if (p && Array.isArray(p.data)) return p.data as Record<string, unknown>[];
  throw new Error("Unerwartete Antwort");
}

async function elev8(tool: string, args: Record<string, unknown>) {
  const url = process.env.ELEV8_MCP_URL || "https://mcp.elev8-suite.com";
  return mcpCallTool(url, process.env.ELEV8_MCP_TOKEN ?? "", tool, args, 180_000);
}

/** Reservierungen (ohne Gästenamen und Reservierungs-IDs). */
async function fetchReservations() {
  const rows = rowsOf(await elev8("get_reservations_by_period_by_tag", { date_field: "check_in", from_date: RES_FROM(), to_date: RES_TO(), listing_tag: TAG() }));
  // Kalendernotizen aus dem Gäste-Feedback (enthält auch Blocker) separat ablegen; Gastnamen echter Buchungen werden nicht gespeichert
  try {
    const today = new Date();
    const from = new Date(today.getTime() - 365 * 864e5).toISOString().slice(0, 10);
    const feedback = rowsOf(await elev8("get_guest_feedback", { from_date: from, to_date: today.toISOString().slice(0, 10) }));
    const notes = notesFromFeedback(feedback, rows);
    console.log(`[portfolio] elev8: ${feedback.length} Feedback-Zeilen, ${notes.length} Kalendernotizen`);
    await sql`INSERT INTO portfolio_cache (source, payload, fetched_at, error) VALUES ('elev8_notes', ${sql.json(notes as never)}, now(), NULL)
      ON CONFLICT (source) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now(), error = NULL`;
  } catch (err) {
    console.error("[portfolio] elev8_notes:", String((err as Error)?.message ?? err).slice(0, 300));
  }
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const k of KEEP) o[k] = ["status", "nights", "number_of_guests", "number_of_adults", "number_of_childrens", "total_amount", "rating"].includes(k) ? num(r[k]) : (r[k] ?? null);
    return o;
  });
}

async function fetchChannels(year: number, month: number) {
  return rowsOf(await elev8("get_channel_performance", { year, month }));
}

/** Booking-IDs der Schweizer Wohnungen (aus properties.json). */
const BOOKING_IDS = () =>
  (properties as { booking_property_id?: unknown }[])
    .map((p) => Number(p.booking_property_id))
    .filter((n) => Number.isInteger(n) && n > 0);

/** Booking-Bewertungen: zuerst über Orbits eigene myDataValue-Anmeldung (Verlauf wie im Claude-Dashboard), sonst über den Proxy. */
async function fetchReviews() {
  if (await mdvConnected()) {
    const ids = BOOKING_IDS();
    if (!ids.length) throw new Error("Keine Booking-IDs in properties.json");
    const r = await mdvRunSql(
      `SELECT public_property_id AS pid, (extract(year FROM observed_on)*10000 + extract(month FROM observed_on)*100 + extract(day FROM observed_on))::int AS day, review_score, recency_weighted_review_score AS recent_score, review_count, is_latest FROM booking_review_score WHERE public_property_id IN (${ids.join(",")}) ORDER BY 1,2`,
      "Orbit Portfolio-Modul Schweiz: Verlauf der Booking.com-Bewertungen der Schweizer Wohnungen für Ranking und Bewertungsanalyse."
    );
    return r.rows.map((x) => ({
      pid: num(x.pid),
      day: num(x.day),
      review_score: num(x.review_score),
      recent_score: num(x.recent_score),
      review_count: num(x.review_count),
      is_latest: x.is_latest === true || x.is_latest === "true"
    }));
  }
  if (!mdvProxyConfigured()) throw new Error("myDataValue nicht verbunden – im Modul „myDataValue verbinden“ klicken");
  return fetchReviewsProxy();
}

/** Rückfall: Booking-Bewertungen über mydatavalue-mcp (/service/api/v1/booking/reviews/). Feldnamen werden tolerant gelesen. */
async function fetchReviewsProxy() {
  const base = (process.env.MDV_MCP_URL ?? "").replace(/\/+$/, "").replace(/\/mcp$/, "");
  const res = await fetch(`${base}/service/api/v1/booking/reviews/?limit=500`, {
    headers: { Authorization: `Bearer ${process.env.MDV_MCP_TOKEN}` },
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) throw new Error(`MyDataValue: HTTP ${res.status}`);
  const list = rowsOf(await res.json());
  const today = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  return list
    .map((r) => ({
      pid: num(r.property_id ?? r.public_property_id ?? r.id),
      day: today,
      review_score: num(r.review_score ?? r.score ?? r.rating),
      recent_score: num(r.recency_weighted_review_score ?? r.recent_score ?? r.review_score ?? r.score),
      review_count: num(r.review_count ?? r.count ?? r.number_of_reviews),
      is_latest: true
    }))
    .filter((r) => r.pid !== null && r.review_score !== null);
}

type Source = { id: string; enabled: () => boolean; fetch: () => Promise<unknown>; missing: string };
const SOURCES: Source[] = [
  { id: "reservations", enabled: elev8Configured, fetch: fetchReservations, missing: "ELEV8_MCP_TOKEN fehlt" },
  { id: "channels_2026_08", enabled: elev8Configured, fetch: () => fetchChannels(2026, 8), missing: "ELEV8_MCP_TOKEN fehlt" },
  { id: "channels_2026_09", enabled: elev8Configured, fetch: () => fetchChannels(2026, 9), missing: "ELEV8_MCP_TOKEN fehlt" },
  { id: "booking_reviews", enabled: () => true, fetch: fetchReviews, missing: "myDataValue nicht verbunden" },
  { id: "airroi_markets", enabled: airroiConfigured, fetch: fetchAirroiMarkets, missing: "AIRROI_API_KEY fehlt" },
  { id: "airroi_trend_sh", enabled: airroiConfigured, fetch: fetchAirroiTrendSh, missing: "AIRROI_API_KEY fehlt" },
  { id: "pricelabs", enabled: pricelabsConfigured, fetch: fetchPricelabs, missing: "PRICELABS_API_KEY fehlt" },
  { id: "hostbuddy", enabled: hostbuddyConfigured, fetch: fetchHostbuddy, missing: "HOSTBUDDY_API_KEY fehlt" },
  // muss nach reservations und hostbuddy stehen: ordnet neue Vorfälle per Claude ein
  { id: "issues_live", enabled: () => elev8Configured() || hostbuddyConfigured(), fetch: fetchIssuesLive, missing: "keine Vorfallquelle" }
];

/** Vorfälle der letzten 12 Monate aus HostBuddy und Kalendernotizen, eingeordnet und auf Deutsch. */
async function fetchIssuesLive() {
  const rows = await sql<{ source: string; payload: unknown }[]>`SELECT source, payload FROM portfolio_cache WHERE source IN ('hostbuddy', 'elev8_notes')`;
  const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const raw = rows.flatMap((r) => (Array.isArray(r.payload) ? (r.payload as RawIssue[]) : [])).filter((r) => r.date >= from && r.date <= today);
  return classifyIssues(raw);
}

let refreshing: Promise<void> | null = null;

async function refresh(force: boolean) {
  const cached = await sql<{ source: string; fetched_at: Date }[]>`SELECT source, fetched_at FROM portfolio_cache`;
  const age = new Map(cached.map((c) => [c.source, Date.now() - new Date(c.fetched_at).getTime()]));
  const due = SOURCES.filter((s) => s.enabled() && (force || !age.has(s.id) || (age.get(s.id) ?? 0) > CACHE_MINUTES() * 60_000));
  for (const s of due) {
    try {
      const payload = await s.fetch();
      await sql`INSERT INTO portfolio_cache (source, payload, fetched_at, error) VALUES (${s.id}, ${sql.json(payload as never)}, now(), NULL)
        ON CONFLICT (source) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now(), error = NULL`;
    } catch (err) {
      const msg = String((err as Error).message ?? err).slice(0, 500);
      console.error(`[portfolio] ${s.id}:`, msg);
      await sql`INSERT INTO portfolio_cache (source, payload, fetched_at, error) VALUES (${s.id}, ${sql.json([] as never)}, to_timestamp(0), ${msg})
        ON CONFLICT (source) DO UPDATE SET error = EXCLUDED.error`;
    }
  }
}

export async function ensureFresh(force = false) {
  if (!refreshing) refreshing = refresh(force).finally(() => (refreshing = null));
  await refreshing;
}

/** Alle Datensätze für die Seite. Live-Quellen aus dem Cache, Stammdaten mit gespeicherten Neubeurteilungen. */
export async function loadDatasets(force = false) {
  await ensureFresh(force);
  const rows = await sql<{ source: string; payload: unknown; fetched_at: Date; error: string | null }[]>`SELECT source, payload, fetched_at, error FROM portfolio_cache`;
  const datasets: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  let fetchedAt: Date | null = null;
  for (const s of SOURCES) {
    const r = rows.find((x) => x.source === s.id);
    const hasData = r && new Date(r.fetched_at).getTime() > 0;
    if (hasData) {
      datasets[s.id] = r.payload;
      if (!fetchedAt || new Date(r.fetched_at) < fetchedAt) fetchedAt = new Date(r.fetched_at);
    }
    if (!s.enabled()) errors[s.id] = s.missing;
    else if (r?.error && !hasData) errors[s.id] = r.error;
  }
  const re = await sql<{ doc_id: string; data: Record<string, string> }[]>`SELECT doc_id, data FROM portfolio_docs WHERE collection = 'neubeurteilung'`;
  const over = new Map(re.map((r) => [r.doc_id, r.data]));
  // Märkte (AirROI live, sonst fester Stand) und PriceLabs-Vergleich pro Wohnung
  const liveMarkets = Array.isArray(datasets.airroi_markets) && (datasets.airroi_markets as unknown[]).length ? (datasets.airroi_markets as typeof markets) : null;
  const mk = liveMarkets ?? markets;
  const byMarket = new Map(mk.map((m) => [m.market, m]));
  const pl = (datasets.pricelabs as { listings?: { key: string; pl_revpar: number; pl_market_revpar: number }[] } | undefined)?.listings ?? null;
  const plByKey = new Map((pl ?? []).map((x) => [x.key, x]));
  datasets.properties = (properties as Record<string, unknown>[]).map((p0) => {
    let p = { ...p0 };
    const m = byMarket.get(String(p.market));
    if (liveMarkets && m) p = { ...p, market_occ: m.occupancy, market_adr: m.adr, market_revpar: m.revpar };
    const x = plByKey.get(String(p.key));
    if (pl) p = { ...p, pl_revpar: x?.pl_revpar ?? null, pl_market_revpar: x?.pl_market_revpar ?? null };
    const o = over.get(String(p.key));
    return o ? { ...p, recommendation: o.recommendation ?? p.recommendation, summary: o.summary ?? p.summary, causes: o.causes ?? p.causes, actions: o.actions ?? p.actions, reassessed_at: o.at ?? null } : p;
  });
  // Vorfälle: Bewertungen aus dem festen Stand behalten, HostBuddy und Kalendernotizen live ersetzen
  // Eine Quelle wird nur ersetzt, wenn sie live tatsächlich Einträge liefert
  const live = Array.isArray(datasets.issues_live) ? (datasets.issues_live as { source: string }[]) : null;
  const liveSources = new Set<string>((live ?? []).map((i) => i.source));
  datasets.issues = [...(issues as { source: string }[]).filter((i) => !liveSources.has(i.source)), ...(live ?? [])];
  datasets.markets = mk;
  datasets.market_trend_sh = Array.isArray(datasets.airroi_trend_sh) && (datasets.airroi_trend_sh as unknown[]).length ? datasets.airroi_trend_sh : marketTrend;
  datasets.pricelabs_months = await pricelabsMonths(pricelabsMonthsStatic as { month: string }[]);
  for (const k of ["airroi_markets", "airroi_trend_sh", "pricelabs", "issues_live"]) delete datasets[k];
  return { datasets, errors, fetchedAt: fetchedAt?.toISOString() ?? null };
}

export const PROPERTIES = properties as { key: string; name: string; city: string; status: string; recommendation: string; summary: string; causes: string; actions: string }[];
