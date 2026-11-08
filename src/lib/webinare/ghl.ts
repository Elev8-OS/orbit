import { ghlConfigured } from "@/lib/offerten/ghl";
import type { Registration, Webinar } from "./store";
import { setRegistrationGhl } from "./store";

/**
 * GHL-Tags pro Webinar. Das Portal setzt bei der Anmeldung `<basis>-angemeldet` (startet den Workflow für
 * Bestätigung und Erinnerungen). Nach dem Webinar ersetzt Orbit ihn durch `<basis>-anwesend` oder
 * `<basis>-verpasst` (starten die Follow-up-Workflows). Den Kundentag setzt Elev8 Suite, nicht Orbit.
 * Nutzt GHL_API_TOKEN und GHL_LOCATION_ID wie die anderen Module.
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

export const tagFor = (w: Pick<Webinar, "ghlTagBase">, kind: "angemeldet" | "anwesend" | "verpasst") => `${w.ghlTagBase}-${kind}`;

async function contactIdFor(r: Registration): Promise<string> {
  if (r.ghlContactId) return r.ghlContactId;
  const upsert = await ghl<{ contact?: { id: string } }>("/contacts/upsert", {
    locationId: process.env.GHL_LOCATION_ID,
    email: r.email,
    firstName: r.firstName || undefined,
    lastName: r.lastName || undefined,
    companyName: r.organization || undefined,
    source: "Webinar-Portal"
  });
  const id = upsert.contact?.id;
  if (!id) throw new Error("GHL hat keine Kontakt-ID geliefert");
  return id;
}

/** Setzt nach dem Webinar pro Person genau einen Status-Tag. Liefert Anzahl ok und Fehler. */
export async function applyStatusTags(webinar: Webinar, regs: Registration[]): Promise<{ ok: number; failed: number; skipped: boolean }> {
  if (!ghlConfigured()) return { ok: 0, failed: 0, skipped: true };
  let ok = 0;
  let failed = 0;
  for (const r of regs) {
    if (r.status === "registered") continue;
    try {
      const id = await contactIdFor(r);
      const add = tagFor(webinar, r.status === "attended" ? "anwesend" : "verpasst");
      const remove = [tagFor(webinar, "angemeldet"), tagFor(webinar, r.status === "attended" ? "verpasst" : "anwesend")];
      await ghl(`/contacts/${encodeURIComponent(id)}/tags`, { tags: remove }, "DELETE");
      await ghl(`/contacts/${encodeURIComponent(id)}/tags`, { tags: [add] });
      await setRegistrationGhl(r.id, { contactId: id, status: `tag:${add}` });
      ok++;
    } catch (err) {
      failed++;
      await setRegistrationGhl(r.id, { status: "error", error: (err instanceof Error ? err.message : String(err)).slice(0, 400) });
    }
  }
  return { ok, failed, skipped: false };
}
