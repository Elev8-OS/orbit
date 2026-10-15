import { sql } from "@/lib/db";
import { mcpCallTool } from "@/lib/portfolio/mcp";
import { callClaudeTool, claudeConfigured, type ToolDef } from "@/lib/offerten/claude";
import properties from "@/lib/portfolio/data/properties.json";

/**
 * Weitere Live-Quellen des Portfolio-Moduls (alle serverseitig, Zugänge nur in Railway):
 * - AirROI (AIRROI_API_KEY): Marktkennzahlen ganze Wohnungen pro Ort und RevPAR-Verlauf Schaffhausen
 * - PriceLabs Customer API (PRICELABS_API_KEY): RevPAR pro Wohnung vs. Markt, Monatswerte des Portfolios
 * - HostBuddy MCP (HOSTBUDDY_API_KEY): Action Items aus der Gästekommunikation
 * - Elev8-Kalendernotizen: Direkt-Blocker ohne Betrag, deren „Gastname“ eine Notiz ist (aus den Reservierungen)
 * Vorfälle aus HostBuddy und Kalendernotizen werden von Claude einer Kategorie zugeordnet und auf Deutsch
 * zusammengefasst; das Ergebnis wird pro Eintrag in portfolio_docs (vorfall_klass) gespeichert.
 */

type Prop = { key: string; name: string; status: string; market: string; elev8_names: string };
const PROPS = properties as unknown as Prop[];

export const airroiConfigured = () => Boolean(process.env.AIRROI_API_KEY);
export const pricelabsConfigured = () => Boolean(process.env.PRICELABS_API_KEY);
export const hostbuddyConfigured = () => Boolean(process.env.HOSTBUDDY_API_KEY);

const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/* ---------- Zuordnung Name → Wohnung ---------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ordnet einen Listing-Namen (Elev8, PriceLabs, HostBuddy) einer Wohnung zu. Längere Namen zuerst, damit
 *  „Suites Hasenberg“ nicht als „Hasenberg Suite“ erkannt wird. */
export function matchProperty(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = ` ${norm(name)} `;
  for (const p of PROPS) {
    for (const e of String(p.elev8_names || "").split("|")) {
      if (e.trim() && n.includes(` ${norm(e)} `)) return p.key;
    }
  }
  const cands = PROPS.map((p) => ({ key: p.key, label: norm(p.name.split(" (")[0]) })).sort((a, b) => b.label.length - a.label.length);
  if (n.includes(" suites hasenberg ")) return "suites_hasenberg";
  if (n.includes(" hasenberg suite ")) return "hasenberg_suite";
  for (const c of cands) if (c.label && n.includes(` ${c.label} `)) return c.key;
  return null;
}

/* ---------- AirROI ---------- */

/** Märkte, gegen die die Wohnungen verglichen werden (Name wie in properties.json → AirROI-Markt). */
export const AIRROI_MARKETS: { market: string; key: string; spec: { country: string; region: string; locality: string } }[] = [
  { market: "Schaffhausen", key: "schaffhausen", spec: { country: "Switzerland", region: "Schaffhausen", locality: "Schaffhausen" } },
  { market: "Neuhausen am Rheinfall", key: "neuhausen", spec: { country: "Switzerland", region: "Schaffhausen", locality: "Neuhausen am Rheinfall" } },
  { market: "Basel", key: "basel", spec: { country: "Switzerland", region: "Basel-City", locality: "Basel" } },
  { market: "Dietikon (Agglo Zürich)", key: "dietikon", spec: { country: "Switzerland", region: "Zurich", locality: "Dietikon" } },
  { market: "Olten (Mittelland)", key: "olten", spec: { country: "Switzerland", region: "Solothurn", locality: "Olten" } },
  { market: "Thun (Berner Oberland)", key: "thun", spec: { country: "Switzerland", region: "Bern", locality: "Thun" } }
];
const ENTIRE = { room_type: { eq: "entire_home" } };

async function airroi(path: string, body: Record<string, unknown>) {
  const base = (process.env.AIRROI_BASE_URL || "https://api.airroi.com").replace(/\/+$/, "");
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "x-api-key": process.env.AIRROI_API_KEY ?? "", "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AirROI ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function fetchAirroiMarkets() {
  const out = [];
  for (const m of AIRROI_MARKETS) {
    const r = await airroi("/markets/summary", { market: m.spec, filter: ENTIRE, currency: "native" });
    out.push({
      market: m.market,
      key: m.key,
      occupancy: num(r.occupancy),
      adr: round1(num(r.average_daily_rate)),
      revpar: round1(num(r.rev_par ?? r.revpar)),
      annual_revenue: num(r.revenue) === null ? null : Math.round(Number(r.revenue)),
      active_listings: round1(num(r.active_listings_count))
    });
  }
  return out;
}

export async function fetchAirroiTrendSh() {
  const r = await airroi("/markets/metrics/revpar", { market: AIRROI_MARKETS[0].spec, filter: ENTIRE, currency: "native", num_months: 24 });
  const rows = (Array.isArray(r.results) ? r.results : []) as { date?: string; avg?: number }[];
  return rows.filter((x) => x.date && x.avg != null).map((x) => ({ month: String(x.date).slice(0, 7), revpar: round1(Number(x.avg)) }));
}

/* ---------- PriceLabs ---------- */

async function pricelabs(path: string, query: Record<string, string> = {}) {
  const base = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(/\/+$/, "");
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${base}${path}${qs ? "?" + qs : ""}`, {
    headers: { "X-API-Key": process.env.PRICELABS_API_KEY ?? "", Accept: "application/json" },
    signal: AbortSignal.timeout(60_000)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PriceLabs ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

type Win = Record<string, number | null | undefined>;
const pick = (w: unknown, ...keys: string[]) => {
  const o = (w ?? {}) as Win;
  for (const k of keys) if (o[k] !== null && o[k] !== undefined) return Number(o[k]);
  return null;
};

/** RevPAR pro Wohnung (letzte 90 Tage) vs. Markt und Kennzahlen des Vormonats für den Portfolio-Verlauf. */
export async function fetchPricelabs() {
  const lst = await pricelabs("/v1/listings");
  const listings = ((lst.listings ?? lst.data ?? []) as Record<string, unknown>[]).filter((l) => !l.isHidden && !l.is_hidden);
  const perProp: Record<string, { revpar: number[]; mrevpar: number[] }> = {};
  const month = { occ: [] as number[], mocc: [] as number[], adr: [] as number[], madr: [] as number[] };
  for (const l of listings) {
    const key = matchProperty(String(l.name ?? l.listing_name ?? ""));
    if (!key) continue;
    const id = String(l.id ?? l.listing_id ?? "");
    const pms = String(l.pms ?? l.pms_name ?? "");
    if (!id || !pms) continue;
    let m: Record<string, unknown>;
    try {
      m = (await pricelabs("/v1/listing_metrics", { listing_id: id, pms_name: pms })).data as Record<string, unknown>;
    } catch {
      continue;
    }
    const L = (m?.listing_level ?? {}) as Record<string, unknown>;
    const M = (m?.market_level ?? {}) as Record<string, unknown>;
    const rp = pick(L.revpar, "-90", "-60", "-30");
    const mo = pick(M.occupancy, "-90", "-60", "-30");
    const ma = pick(M.adr, "-90", "-60", "-30");
    if (rp !== null && mo !== null && ma !== null) {
      (perProp[key] ||= { revpar: [], mrevpar: [] }).revpar.push(rp);
      perProp[key].mrevpar.push((mo / 100) * ma);
    }
    const po = pick(L.occupancy, "-998"), pa = pick(L.adr, "-998"), qo = pick(M.occupancy, "-998"), qa = pick(M.adr, "-998");
    if (po !== null && qo !== null && qa !== null) {
      month.occ.push(po / 100);
      month.mocc.push(qo / 100);
      if (pa) month.adr.push(pa);
      month.madr.push(qa);
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const props = Object.entries(perProp).map(([key, v]) => ({ key, pl_revpar: Math.round(avg(v.revpar) ?? 0), pl_market_revpar: Math.round(avg(v.mrevpar) ?? 0) }));
  const d = new Date();
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const occ = avg(month.occ), mocc = avg(month.mocc), adr = avg(month.adr), madr = avg(month.madr);
  const monthRow =
    occ !== null && mocc !== null && madr !== null
      ? { month: prev, occ: Math.round(occ * 1000) / 1000, mkt_occ: Math.round(mocc * 100) / 100, adr: adr ? Math.round(adr) : null, mkt_adr: Math.round(madr), revpar: adr ? Math.round(occ * adr) : null, mkt_revpar: Math.round(mocc * madr) }
      : null;
  if (monthRow) {
    await sql`INSERT INTO portfolio_docs (collection, doc_id, data, updated_by) VALUES ('pricelabs_monat', ${prev}, ${sql.json(monthRow as never)}, 'pricelabs')
      ON CONFLICT (collection, doc_id) DO UPDATE SET data = EXCLUDED.data, version = portfolio_docs.version + 1, updated_at = now()`;
  }
  return { listings: props, month: monthRow };
}

/** Monatsverlauf PriceLabs: fester Stand plus jeden Monat gespeicherte Werte (gespeicherte haben Vorrang). */
export async function pricelabsMonths(staticRows: { month: string }[]) {
  const rows = await sql<{ doc_id: string; data: Record<string, unknown> }[]>`SELECT doc_id, data FROM portfolio_docs WHERE collection = 'pricelabs_monat'`;
  const byMonth = new Map<string, Record<string, unknown>>(staticRows.map((r) => [r.month, r as Record<string, unknown>]));
  for (const r of rows) byMonth.set(r.doc_id, r.data);
  return [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

/* ---------- HostBuddy und Elev8-Kalendernotizen ---------- */

export type RawIssue = { id: string; key: string; date: string; text: string; source: "HostBuddy" | "Elev8 Kalendernotiz"; hint?: string };

export async function fetchHostbuddy(): Promise<RawIssue[]> {
  const url = process.env.HOSTBUDDY_MCP_URL || "https://api.hostbuddy.ai/mcp";
  const tool = process.env.HOSTBUDDY_TOOL || "listActionItems";
  // Werkzeugname je nach HostBuddy-Version: zuerst der eingestellte, dann die snake_case-Variante
  let r: Record<string, unknown> | null = null;
  let lastErr: unknown = null;
  for (const t of [...new Set([tool, "listActionItems", "list_action_items"])]) {
    try {
      r = (await mcpCallTool(url, process.env.HOSTBUDDY_API_KEY ?? "", t, { limit: 500 }, 120_000)) as Record<string, unknown>;
      break;
    } catch (err) {
      lastErr = err;
      if (!/tool|not found|unknown/i.test(String((err as Error)?.message ?? err))) throw err;
    }
  }
  if (!r) throw lastErr ?? new Error("HostBuddy: keine Antwort");
  const list = (Array.isArray(r) ? r : (r?.data ?? r?.items ?? r?.action_items ?? [])) as Record<string, unknown>[];
  const out: RawIssue[] = [];
  for (const a of list) {
    const key = matchProperty(String(a.property_name ?? a.listing_name ?? ""));
    const text = String(a.item ?? a.description ?? a.title ?? "").trim();
    const date = String(a.created_at_utc ?? a.created_at ?? "").slice(0, 10);
    if (!key || !text || !date) continue;
    out.push({ id: "hb_" + String(a.action_item_id ?? a.id ?? `${key}_${date}_${text.slice(0, 20)}`), key, date, text: text.slice(0, 400), source: "HostBuddy", hint: String(a.category ?? "") });
  }
  return out;
}

/** Kalendernotizen: Direkt-Einträge ohne Betrag, bei denen Elev8 den Notiztext im Gastnamen führt. */
export function notesFromReservations(rows: Record<string, unknown>[]): RawIssue[] {
  const out: RawIssue[] = [];
  for (const r of rows) {
    if (String(r.channel ?? "") !== "DIRECT") continue;
    const amt = num(r.total_amount);
    if (amt !== null && amt > 0) continue;
    const text = String(r.guest_name ?? "").trim();
    const key = matchProperty(String(r.listing_name ?? ""));
    const date = String(r.check_in_date ?? "").slice(0, 10);
    if (!text || !key || !date || text.length < 4) continue;
    out.push({ id: `kn_${key}_${date}_${norm(text).slice(0, 40).replace(/ /g, "_")}`, key, date, text: text.slice(0, 300), source: "Elev8 Kalendernotiz" });
  }
  return out;
}

const CATS = ["Zugang", "Reinigung", "WLAN", "Instandhaltung", "Ausstattung", "Schimmel", "Schädlinge", "Geruch", "Wasserschaden", "Gästeführung", "Service", "Parkplatz", "Erwartung", "Chance"] as const;

const CLASS_TOOL: ToolDef = {
  name: "save_classification",
  description: "Speichert pro Eintrag, ob er ein Betriebsproblem oder eine Chance ist, mit Kategorie und kurzem deutschem Text.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            relevant: { type: "boolean", description: "true nur bei einem echten Problem in der Wohnung oder im Ablauf (Zugang, Reinigung, Defekt …) oder einer Geschäftschance (z. B. Anfrage Langzeitmiete). false bei Routine: Check-in-Zeit, Wegbeschreibung, Gepäck, Rechnung, normale Reinigung, Stornierung, Eigentümernutzung." },
            category: { type: "string", enum: [...CATS] },
            text: { type: "string", description: "Kurz auf Deutsch (Schweiz, „ss“), höchstens 90 Zeichen, ohne Gastnamen." }
          },
          required: ["id", "relevant", "category", "text"]
        }
      }
    },
    required: ["items"]
  }
};

/** Ordnet neue Einträge per Claude zu und liefert alle relevanten Vorfälle im Format von issues.json. */
export async function classifyIssues(raw: RawIssue[]) {
  const known = new Map(
    (await sql<{ doc_id: string; data: { relevant: boolean; category: string; text: string } }[]>`SELECT doc_id, data FROM portfolio_docs WHERE collection = 'vorfall_klass'`).map((r) => [r.doc_id, r.data])
  );
  const fresh = raw.filter((r) => !known.has(r.id));
  if (fresh.length && claudeConfigured()) {
    for (let i = 0; i < fresh.length; i += 60) {
      const batch = fresh.slice(i, i + 60);
      try {
        const out = (await callClaudeTool({
          system: "Du ordnest Meldungen aus der Gästekommunikation und Kalendernotizen von Ferienwohnungen in der Schweiz ein. Antworte nur über das Tool.",
          user: batch.map((b) => `${b.id} | ${b.source}${b.hint ? " / " + b.hint : ""} | ${b.text}`).join("\n"),
          tool: CLASS_TOOL,
          maxTokens: 6000,
          timeoutMs: 120_000
        })) as { items?: { id: string; relevant: boolean; category: string; text: string }[] };
        for (const it of out.items ?? []) {
          if (!batch.some((b) => b.id === it.id)) continue;
          const data = { relevant: Boolean(it.relevant), category: CATS.includes(it.category as (typeof CATS)[number]) ? it.category : "Service", text: String(it.text).slice(0, 160) };
          known.set(it.id, data);
          await sql`INSERT INTO portfolio_docs (collection, doc_id, data, updated_by) VALUES ('vorfall_klass', ${it.id}, ${sql.json(data as never)}, 'claude')
            ON CONFLICT (collection, doc_id) DO NOTHING`;
        }
      } catch (err) {
        console.error("[portfolio] Klassifizierung:", err);
      }
    }
  }
  return raw
    .map((r) => ({ r, k: known.get(r.id) }))
    .filter(({ k }) => k && k.relevant)
    .map(({ r, k }) => ({ key: r.key, date: r.date, category: k!.category, text: k!.text, source: r.source }));
}
