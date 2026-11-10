import { ghlConfigured } from "@/lib/offerten/ghl";
import type { Registration, Webinar } from "./store";
import { setRegistrationGhl } from "./store";

/**
 * GHL-Tags pro Webinar. Das Portal setzt bei der Anmeldung `<basis>-registered` (startet den Workflow für
 * Bestätigung und Erinnerungen). Nach dem Webinar ersetzt Orbit ihn durch `<basis>-attended` oder
 * `<basis>-missed` (starten die Follow-up-Workflows), für nachgelieferte Unterlagen kommt `<basis>-materials` dazu.
 * Den Kundentag setzt Elev8 Suite, nicht Orbit. Nutzt GHL_API_TOKEN und GHL_LOCATION_ID wie die anderen Module.
 * Bis November 2026 hiessen die Zusätze deutsch (-angemeldet, -anwesend, -verpasst, -unterlagen); solche Tags
 * werden beim Abschliessen entfernt oder mit migrateLegacyTags umgestellt.
 */

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

async function ghl<T>(path: string, body: unknown, method: "GET" | "POST" | "PUT" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
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

export type TagKind = "registered" | "attended" | "missed" | "materials";
export const tagFor = (w: Pick<Webinar, "ghlTagBase">, kind: TagKind) => `${w.ghlTagBase}-${kind}`;

/** Frühere deutsche Zusätze, für Kontakte, die sie noch tragen */
const LEGACY: Record<TagKind, string> = { registered: "angemeldet", attended: "anwesend", missed: "verpasst", materials: "unterlagen" };
const KINDS = Object.keys(LEGACY) as TagKind[];
const legacyTag = (w: Pick<Webinar, "ghlTagBase">, kind: TagKind) => `${w.ghlTagBase}-${LEGACY[kind]}`;

/** Trägt eine Anmeldung nach unserem Stand noch einen deutschen Tag? (ghl_status aus Portal bzw. Orbit) */
export const hasLegacyTag = (r: Pick<Registration, "ghlStatus">) => /^tag:(?:.*-)?(angemeldet|anwesend|verpasst|unterlagen)$/.test(r.ghlStatus ?? "");

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
      const add = tagFor(webinar, r.status === "attended" ? "attended" : "missed");
      // Auch die früheren deutschen Tags weg, damit kein alter Workflow mehr greift
      const remove = [
        tagFor(webinar, "registered"),
        tagFor(webinar, r.status === "attended" ? "missed" : "attended"),
        legacyTag(webinar, "registered"),
        legacyTag(webinar, "attended"),
        legacyTag(webinar, "missed")
      ];
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

/** Setzt einen zusätzlichen Tag bei allen Personen (z. B. `<basis>-materials` für den Unterlagen-Workflow). */
export async function addTag(tag: string, regs: Registration[]): Promise<{ ok: number; failed: number; skipped: boolean }> {
  if (!ghlConfigured()) return { ok: 0, failed: 0, skipped: true };
  let ok = 0;
  let failed = 0;
  for (const r of regs) {
    try {
      const id = await contactIdFor(r);
      await ghl(`/contacts/${encodeURIComponent(id)}/tags`, { tags: [tag] });
      if (!r.ghlContactId) await setRegistrationGhl(r.id, { contactId: id, status: r.ghlStatus ?? `tag:${tag}` });
      ok++;
    } catch (err) {
      failed++;
      console.error("GHL-Tag", tag, r.email, err instanceof Error ? err.message : err);
    }
  }
  return { ok, failed, skipped: false };
}

/**
 * Einmalige Umstellung: liest pro Kontakt die Tags in GHL und ersetzt die deutschen Tags dieses Webinars durch die
 * englischen (nur die, die wirklich gesetzt sind). Liefert umgestellte Kontakte, unveränderte und Fehler.
 */
export async function migrateLegacyTags(webinar: Webinar, regs: Registration[]): Promise<{ changed: number; unchanged: number; failed: number; skipped: boolean }> {
  if (!ghlConfigured()) return { changed: 0, unchanged: 0, failed: 0, skipped: true };
  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  for (const r of regs) {
    try {
      const id = await contactIdFor(r);
      const data = await ghl<{ contact?: { tags?: string[] } }>(`/contacts/${encodeURIComponent(id)}`, undefined, "GET");
      const has = new Set((data.contact?.tags ?? []).map((t) => t.toLowerCase()));
      const kinds = KINDS.filter((k) => has.has(legacyTag(webinar, k).toLowerCase()));
      if (kinds.length) {
        await ghl(`/contacts/${encodeURIComponent(id)}/tags`, { tags: kinds.map((k) => legacyTag(webinar, k)) }, "DELETE");
        await ghl(`/contacts/${encodeURIComponent(id)}/tags`, { tags: kinds.map((k) => tagFor(webinar, k)) });
        changed++;
      } else unchanged++;
      // Unseren Stand nachführen: Status-Tag der Anmeldung englisch
      const status = r.ghlStatus?.match(/^tag:(?:.*-)?(angemeldet|anwesend|verpasst|unterlagen)$/)?.[1];
      const kind = KINDS.find((k) => LEGACY[k] === status);
      if (kind || !r.ghlContactId) await setRegistrationGhl(r.id, { contactId: id, status: kind ? `tag:${tagFor(webinar, kind)}` : r.ghlStatus ?? "" });
    } catch (err) {
      failed++;
      console.error("GHL-Tags umstellen", r.email, err instanceof Error ? err.message : err);
    }
  }
  return { changed, unchanged, failed, skipped: false };
}
