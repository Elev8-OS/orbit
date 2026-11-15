import { decrypt } from "@/lib/platform/crypto";
import { mcpCallTool } from "@/lib/portfolio/mcp";
import { DEFAULT_TENANT } from "./access";
import type { Tenant } from "./types";

/**
 * Live-Anbindung an Elev8 über den MCP-Server von Elev8 (pro Mandant eigener Zugang, nur dessen Daten).
 * Elev8 meldet Änderungen nicht von selbst, daher holen wir bei jedem Aufruf frisch (kurzer Zwischenspeicher,
 * Standard 45 Sekunden) und die Seiten laden sich selbst nach. Fällt Elev8 aus, zeigen wir den letzten Stand mit Hinweis.
 */
const TTL = () => Number(process.env.GRO_CACHE_SECONDS || 45) * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

export type Creds = { url: string; token: string };

export function credsFor(t: Tenant, sealed: string | null): Creds | null {
  const url = t.elev8Url || process.env.ELEV8_MCP_URL || "https://mcp.elev8-suite.com";
  if (sealed) return { url, token: decrypt(sealed) };
  if (t.slug === DEFAULT_TENANT() && process.env.ELEV8_MCP_TOKEN) return { url, token: process.env.ELEV8_MCP_TOKEN };
  return null;
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const p = payload as { results?: unknown } | null;
  if (p && Array.isArray(p.results)) return p.results as Record<string, unknown>[];
  if (p && typeof p === "object") return [p as Record<string, unknown>];
  throw new Error("Unerwartete Antwort von Elev8");
}

export type Live<T> = { ok: true; rows: T[]; at: number; stale: boolean } | { ok: false; error: string; configured: boolean };

export async function call<T = Record<string, unknown>>(t: Tenant, creds: Creds | null, tool: string, args: Record<string, unknown>): Promise<Live<T>> {
  if (!creds) return { ok: false, error: "Für diesen Mandanten ist noch kein Elev8-Zugang hinterlegt.", configured: false };
  const key = `${t.id}:${tool}:${JSON.stringify(args)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL()) return { ok: true, rows: hit.value as T[], at: hit.at, stale: false };
  try {
    const rows = rowsOf(await mcpCallTool(creds.url, creds.token, tool, args, 25_000)) as T[];
    cache.set(key, { at: Date.now(), value: rows });
    return { ok: true, rows, at: Date.now(), stale: false };
  } catch (err) {
    if (hit) return { ok: true, rows: hit.value as T[], at: hit.at, stale: true };
    return { ok: false, error: err instanceof Error ? err.message : String(err), configured: true };
  }
}

export type LiveListing = {
  listing_id: string;
  listing_name: string;
  internal_name: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  maximum_capacity: number | null;
  lock_type: string | null;
  status: number | null;
};
export type LiveGuest = {
  channel: string;
  check_in_date: string;
  guest_name: string;
  language: string;
  listing_name: string;
  number_of_guests: number;
  reservation_id: string;
  total_verified_guest: number;
  verification_step: number;
};
export type LiveCheckin = {
  channel: string;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  estimated_check_in_time: string;
  guest_name: string;
  listing_name: string;
  nights: number;
  number_of_guests: number;
  number_of_adults: number;
  number_of_childrens: number;
  pms_reservation_id: string;
  notes: string;
};
export type LiveTag = { listing_id: string; listing_name: string; tag_name: string };

export const countryCode = (c: string | null | undefined) => {
  const v = (c ?? "").trim().toLowerCase();
  if (["ch", "schweiz", "switzerland"].includes(v)) return "CH";
  if (["id", "indonesia", "indonesien"].includes(v)) return "ID";
  return (c ?? "").trim() || "?";
};

/** Namen der Listings, die zum Mandanten gehören (Tag-Filter); null = alle */
export async function allowedListingNames(t: Tenant, creds: Creds | null): Promise<Set<string> | null> {
  if (!t.listingTags.length) return null;
  const tags = await call<LiveTag>(t, creds, "get_listing_tags", {});
  if (!tags.ok) return null;
  const wanted = new Set(t.listingTags.map((x) => x.toLowerCase()));
  return new Set(tags.rows.filter((r) => wanted.has(String(r.tag_name).trim().toLowerCase())).map((r) => r.listing_name));
}

export async function testConnection(t: Tenant, creds: Creds | null): Promise<{ ok: boolean; text: string }> {
  const r = await call<Record<string, unknown>>(t, creds, "get_tenant_profile", {});
  if (!r.ok) return { ok: false, text: r.error };
  const p = (r.rows[0] ?? {}) as Record<string, unknown>;
  return { ok: true, text: `Verbunden${p.company_name || p.brand_name ? ": " + String(p.company_name ?? p.brand_name) : ""}` };
}
