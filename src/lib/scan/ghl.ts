import { ghlConfigured, userByEmail, contactUrl } from "@/lib/sales/ghl";
import type { MesseEvent } from "@/lib/messen/store";
import type { DuplicateHit, ScanContact } from "./types";

/**
 * GoHighLevel-Anbindung des Scanners. Nutzt GHL_API_TOKEN und GHL_LOCATION_ID wie Offerten, Sales und Messen.
 * Zusätzlich nötige Scopes: locations/tags.readonly, locations/tags.write, medias.write (für die Kartenfotos).
 * Der Kontakt wird dem GHL-User zugewiesen, dessen E-Mail der Orbit-Anmeldung entspricht (users.readonly).
 */

export { ghlConfigured, contactUrl };

const BASE = () => process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const loc = () => process.env.GHL_LOCATION_ID ?? "";

async function ghl<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.GHL_API_TOKEN}`);
  headers.set("Version", VERSION);
  headers.set("Accept", "application/json");
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE()}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = (json as { message?: string | string[] } | null)?.message;
    throw new Error(`GHL ${res.status}: ${Array.isArray(message) ? message.join("; ") : message ?? text.slice(0, 200)}`);
  }
  return json as T;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

// ── Tags ────────────────────────────────────────────────────

let tagCache: { at: number; value: string[] } | null = null;

export async function listTags(fresh = false): Promise<string[]> {
  if (!fresh && tagCache && Date.now() - tagCache.at < 5 * 60_000) return tagCache.value;
  const data = await ghl<{ tags?: { name?: string }[] }>(`/locations/${loc()}/tags`);
  const value = [...new Set((data.tags ?? []).map((t) => str(t.name).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  tagCache = { at: Date.now(), value };
  return value;
}

export async function createTag(name: string): Promise<string> {
  const clean = name.trim();
  await ghl(`/locations/${loc()}/tags`, { method: "POST", body: JSON.stringify({ name: clean }) });
  tagCache = null;
  return clean;
}

// ── Dubletten ───────────────────────────────────────────────

export async function findDuplicate(email: string | null, phone: string | null): Promise<DuplicateHit> {
  const tryLookup = async (params: Record<string, string>) => {
    try {
      const q = new URLSearchParams({ locationId: loc(), ...params });
      const data = await ghl<{ contact?: Record<string, unknown> | null }>(`/contacts/search/duplicate?${q}`);
      return data.contact?.id ? data.contact : null;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("GHL 404")) return null;
      throw err;
    }
  };
  const c = (email ? await tryLookup({ email }) : null) ?? (phone ? await tryLookup({ phone }) : null);
  if (!c) return { found: false };
  const id = str(c.id);
  return {
    found: true,
    contact: {
      id,
      name: [str(c.firstName), str(c.lastName)].filter(Boolean).join(" ") || str(c.contactName),
      company: str(c.companyName),
      email: str(c.email),
      phone: str(c.phone),
      url: contactUrl(id)
    }
  };
}

// ── Kontakt-Felder (Titel, Mobil, LinkedIn, Branche, Sprache) ──

type FieldDef = { id: string; name: string; dataType: string; options: unknown[] | null };
const ALIASES: Record<string, string[]> = {
  title: ["job title", "title", "position", "role", "jobtitel", "funktion"],
  mobile: ["mobile", "mobile phone", "cell", "cell phone", "handy", "mobilnummer", "mobil"],
  linkedin: ["linkedin", "linkedin url", "linkedin profile", "linkedin-profil"],
  industry: ["industry", "sector", "branche"],
  language: ["preferred language", "language", "sprache", "bevorzugte sprache"]
};
/** Name, unter dem ein fehlendes Feld angelegt wird */
const CREATE_AS: Record<string, string> = {
  title: "Job Title",
  mobile: "Mobile",
  linkedin: "LinkedIn",
  industry: "Industry",
  language: "Preferred Language"
};
const LANGUAGE_OPTIONS: Record<string, string[]> = {
  de: ["de", "deutsch", "german"],
  en: ["en", "english", "englisch"],
  fr: ["fr", "french", "französisch", "francais", "français"],
  es: ["es", "spanish", "spanisch", "español"],
  it: ["it", "italian", "italienisch", "italiano"],
  id: ["id", "indonesian", "indonesisch", "bahasa"],
  nl: ["nl", "dutch", "niederländisch", "nederlands"],
  pt: ["pt", "portuguese", "portugiesisch", "português"],
  ja: ["ja", "japanese", "japanisch"],
  zh: ["zh", "chinese", "chinesisch", "mandarin"],
  tr: ["tr", "turkish", "türkisch"],
  ru: ["ru", "russian", "russisch"],
  ar: ["ar", "arabic", "arabisch"]
};

let fieldCache: { at: number; value: FieldDef[] } | null = null;

async function customFields(fresh = false): Promise<FieldDef[]> {
  if (!fresh && fieldCache && Date.now() - fieldCache.at < 10 * 60_000) return fieldCache.value;
  const data = await ghl<{ customFields?: Record<string, unknown>[] }>(`/locations/${loc()}/customFields?model=contact`);
  const value = (data.customFields ?? [])
    .filter((f) => !f.model || f.model === "contact")
    .map((f) => ({
      id: str(f.id),
      name: str(f.name),
      dataType: str(f.dataType).toUpperCase(),
      options: Array.isArray(f.picklistOptions) ? f.picklistOptions : Array.isArray(f.options) ? f.options : null
    }));
  fieldCache = { at: Date.now(), value };
  return value;
}

function optionValue(wanted: string[], options: unknown[]): string | null {
  const norm = (s: unknown) => str(s).toLowerCase().trim();
  for (const w of wanted) {
    for (const o of options) {
      if (typeof o === "string") {
        if (norm(o) === w || norm(o).startsWith(w)) return o;
      } else if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if ([r.value, r.label, r.name, r.key].some((v) => norm(v) === w || norm(v).startsWith(w))) {
          return str(r.value || r.key || r.label || r.name);
        }
      }
    }
  }
  return null;
}

/**
 * Bildet die Zusatzangaben auf Kontaktfelder ab. Fehlt ein Feld, legt Orbit es als Textfeld an
 * (Scope locations/customFields.write; ohne ihn landet der Wert nur in der Notiz).
 * Liefert die Felder für den Upsert und die Werte, die nur in die Notiz können.
 */
export async function mapExtras(extras: Record<string, string | null>): Promise<{
  customFields: { id: string; field_value: string }[];
  leftover: Record<string, string>;
}> {
  const mapped: { id: string; field_value: string }[] = [];
  const leftover: Record<string, string> = {};
  let fields = await customFields();
  for (const [key, raw] of Object.entries(extras)) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const aliases = ALIASES[key] ?? [key];
    let f = fields.find((x) => aliases.includes(x.name.toLowerCase().trim()));
    if (!f && CREATE_AS[key]) {
      try {
        const r = await ghl<{ customField?: { id?: string } }>(`/locations/${loc()}/customFields`, {
          method: "POST",
          body: JSON.stringify({ name: CREATE_AS[key], dataType: "TEXT", model: "contact" })
        });
        if (r.customField?.id) {
          f = { id: str(r.customField.id), name: CREATE_AS[key], dataType: "TEXT", options: null };
          fieldCache = null;
          fields = [...fields, f];
        }
      } catch (err) {
        console.warn(`Scan: GHL-Feld „${CREATE_AS[key]}“ nicht angelegt:`, err instanceof Error ? err.message : err);
      }
    }
    if (!f) {
      leftover[key] = value;
      continue;
    }
    if (["SINGLE_OPTIONS", "MULTIPLE_OPTIONS", "RADIO", "CHECKBOX"].includes(f.dataType)) {
      const wanted = key === "language" ? (LANGUAGE_OPTIONS[value.toLowerCase()] ?? [value.toLowerCase()]) : [value.toLowerCase()];
      const opt = f.options ? optionValue(wanted, f.options) : null;
      if (!opt) {
        leftover[key] = value;
        continue;
      }
      mapped.push({ id: f.id, field_value: opt });
    } else if (["DATE", "NUMERICAL", "MONETORY"].includes(f.dataType)) {
      leftover[key] = value;
    } else {
      mapped.push({ id: f.id, field_value: value });
    }
  }
  return { customFields: mapped, leftover };
}

// ── Upsert, Notiz, Fotos ────────────────────────────────────

export type UpsertInput = {
  contact: ScanContact;
  tags: string[];
  source: string;
  scannedBy: { name: string; email: string };
};

export async function upsertContact(input: UpsertInput): Promise<{ id: string; isNew: boolean; warnings: string[] }> {
  const c = input.contact;
  const warnings: string[] = [];
  const { customFields, leftover } = await mapExtras({
    title: c.title,
    mobile: c.mobile,
    linkedin: c.linkedin,
    industry: c.industry,
    language: c.language
  });
  const ghlUser = await userByEmail(input.scannedBy.email).catch(() => null);
  if (!ghlUser) warnings.push("Kein GHL-User mit deiner E-Mail gefunden – Kontakt bleibt ohne Zuweisung.");

  const body: Record<string, unknown> = {
    locationId: loc(),
    firstName: c.firstName || undefined,
    lastName: c.lastName || undefined,
    email: c.email || undefined,
    phone: c.phone || c.mobile || undefined,
    companyName: c.company || undefined,
    website: c.website || undefined,
    address1: c.street || undefined,
    city: c.city || undefined,
    state: c.state || undefined,
    postalCode: c.postalCode || undefined,
    country: c.country || undefined,
    timezone: c.timezone || undefined,
    source: input.source,
    tags: input.tags.length ? input.tags : undefined,
    customFields: customFields.length ? customFields : undefined,
    assignedTo: ghlUser?.id
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];

  const data = await ghl<{ contact?: { id?: string }; new?: boolean }>("/contacts/upsert", { method: "POST", body: JSON.stringify(body) });
  const id = str(data.contact?.id);
  if (!id) throw new Error("GHL hat keine Kontakt-ID geliefert");

  const noteLines = [
    `Visitenkarte gescannt von ${input.scannedBy.name} am ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    c.sourceType === "linkedin_profile" ? "Quelle: LinkedIn-Profil" : "",
    c.handwritten ? "Handschriftliche Karte – Angaben vor dem Senden geprüft" : "",
    leftover.title ? `Position: ${leftover.title}` : "",
    leftover.mobile ? `Mobil: ${leftover.mobile}` : "",
    leftover.linkedin ? `LinkedIn: ${leftover.linkedin}` : "",
    leftover.industry ? `Branche: ${leftover.industry}` : "",
    leftover.language ? `Sprache: ${leftover.language}` : "",
    c.roleTags?.length ? `Rolle: ${c.roleTags.join(", ")}` : "",
    c.notes ? `\n${c.notes}` : ""
  ].filter(Boolean);
  try {
    await ghl(`/contacts/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ body: noteLines.join("\n") }) });
  } catch (err) {
    warnings.push(`Notiz nicht gespeichert: ${err instanceof Error ? err.message : err}`);
  }
  return { id, isNew: data.new !== false, warnings };
}

async function uploadMedia(dataUrl: string, filename: string): Promise<string | null> {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), filename);
  fd.append("name", filename);
  fd.append("locationId", loc());
  fd.append("altType", "location");
  fd.append("altId", loc());
  const data = await ghl<Record<string, unknown>>("/medias/upload-file", { method: "POST", body: fd });
  return str(data.fileUrl || data.url || data.path || data.publicUrl) || null;
}

/** Kartenfotos in die GHL-Mediathek laden und als Notiz am Kontakt verlinken. Fehler brechen den Scan nicht ab. */
export async function attachPhotos(contactId: string, photos: { front?: string | null; back?: string | null }): Promise<{ count: number; warnings: string[] }> {
  const warnings: string[] = [];
  const links: string[] = [];
  const ts = Date.now();
  for (const [side, dataUrl] of [["front", photos.front], ["back", photos.back]] as const) {
    if (!dataUrl) continue;
    try {
      const url = await uploadMedia(dataUrl, `card-${contactId}-${ts}-${side}.jpg`);
      if (url) links.push(`${side === "front" ? "Vorderseite" : "Rückseite"}: ${url}`);
    } catch (err) {
      warnings.push(`Foto (${side}) nicht hochgeladen: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (links.length) {
    try {
      await ghl(`/contacts/${encodeURIComponent(contactId)}/notes`, { method: "POST", body: JSON.stringify({ body: ["Kartenfotos:", ...links].join("\n") }) });
    } catch (err) {
      warnings.push(`Foto-Notiz nicht gespeichert: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { count: links.length, warnings };
}

/** Quelle und Tags, wenn der Scan einer Messe zugeordnet ist (gleiche Konvention wie die Gewinnspiel-Leads). */
export function eventSourceAndTags(event: MesseEvent | null, scannerName: string): { source: string; tags: string[] } {
  if (!event) return { source: `Visitenkarte – ${scannerName}`, tags: ["visitenkarte"] };
  const slug = event.slug.toLowerCase().replace(/[^a-z0-9+-]+/g, "-").replace(/^-+|-+$/g, "");
  return { source: `Messe: ${event.name}`, tags: ["visitenkarte", "messe-lead", `messe-${slug}`, ...event.ghlTags] };
}
