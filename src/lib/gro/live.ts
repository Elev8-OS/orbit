import { allowedListingNames, call, credsFor, type Creds, type Live, type LiveListing } from "./elev8";
import { tenantSecrets } from "./store";
import type { Tenant } from "./types";

/** Zugang und erlaubte Listings eines Mandanten. Ein defekter Schlüssel zählt als nicht konfiguriert. */
export async function liveContext(t: Tenant): Promise<{ creds: Creds | null; allowed: Set<string> | null; problem?: string }> {
  try {
    const creds = credsFor(t, await tenantSecrets(t.id));
    return { creds, allowed: await allowedListingNames(t, creds) };
  } catch (err) {
    return { creds: null, allowed: null, problem: err instanceof Error ? err.message : String(err) };
  }
}

export const keep = <T extends { listing_name: string }>(rows: T[], allowed: Set<string> | null) => (allowed ? rows.filter((r) => allowed.has(r.listing_name)) : rows);

export const liveListings = (t: Tenant, creds: Creds | null): Promise<Live<LiveListing>> => call<LiveListing>(t, creds, "get_listings_overview", {});
