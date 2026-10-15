import { sql } from "@/lib/db";
import { mcpCallTool } from "@/lib/portfolio/mcp";
import properties from "@/lib/portfolio/data/properties.json";
import issues from "@/lib/portfolio/data/issues.json";
import markets from "@/lib/portfolio/data/markets.json";
import marketTrend from "@/lib/portfolio/data/market_trend_sh.json";
import pricelabsMonths from "@/lib/portfolio/data/pricelabs_months.json";

/**
 * Datenquellen des Portfolio-Moduls. Live-Daten werden serverseitig mit den Zugängen aus Railway geholt
 * und in portfolio_cache zwischengespeichert (Standard 60 Minuten, PORTFOLIO_CACHE_MINUTES):
 * - Elev8 Suite (MCP): ELEV8_MCP_URL, ELEV8_MCP_TOKEN – Reservierungen und Kanal-Kennzahlen
 * - MyDataValue über den Dienst mydatavalue-mcp: MDV_MCP_URL, MDV_MCP_TOKEN – Booking-Bewertungen
 * Stammdaten (Empfehlungen, Märkte, Vorfälle) liegen in data/*.json; Neubeurteilungen aus portfolio_docs überschreiben sie.
 */

const CACHE_MINUTES = () => Number(process.env.PORTFOLIO_CACHE_MINUTES || 60);
const RES_FROM = () => process.env.PORTFOLIO_RES_FROM || "2024-10-01";
const RES_TO = () => process.env.PORTFOLIO_RES_TO || "2027-12-31";
const TAG = () => process.env.PORTFOLIO_LISTING_TAG || "Swiss";

export const elev8Configured = () => Boolean(process.env.ELEV8_MCP_TOKEN);
export const mdvConfigured = () => Boolean(process.env.MDV_MCP_URL && process.env.MDV_MCP_TOKEN);

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
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const k of KEEP) o[k] = ["status", "nights", "number_of_guests", "number_of_adults", "number_of_childrens", "total_amount", "rating"].includes(k) ? num(r[k]) : (r[k] ?? null);
    return o;
  });
}

async function fetchChannels(year: number, month: number) {
  return rowsOf(await elev8("get_channel_performance", { year, month }));
}

/** Booking-Bewertungen über mydatavalue-mcp (/service/api/v1/booking/reviews/). Feldnamen werden tolerant gelesen. */
async function fetchReviews() {
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
  { id: "booking_reviews", enabled: mdvConfigured, fetch: fetchReviews, missing: "MDV_MCP_URL / MDV_MCP_TOKEN fehlen" }
];

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
  datasets.properties = (properties as Record<string, unknown>[]).map((p) => {
    const o = over.get(String(p.key));
    return o ? { ...p, recommendation: o.recommendation ?? p.recommendation, summary: o.summary ?? p.summary, causes: o.causes ?? p.causes, actions: o.actions ?? p.actions, reassessed_at: o.at ?? null } : p;
  });
  datasets.issues = issues;
  datasets.markets = markets;
  datasets.market_trend_sh = marketTrend;
  datasets.pricelabs_months = pricelabsMonths;
  return { datasets, errors, fetchedAt: fetchedAt?.toISOString() ?? null };
}

export const PROPERTIES = properties as { key: string; name: string; city: string; status: string; recommendation: string; summary: string; causes: string; actions: string }[];
