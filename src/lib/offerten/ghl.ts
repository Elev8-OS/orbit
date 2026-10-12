/**
 * GoHighLevel (LeadConnector) API v2.
 * Benötigt GHL_API_TOKEN (Private Integration Token der Subaccount-Location) und GHL_LOCATION_ID.
 * Nötige Scopes: contacts.readonly, contacts.write, opportunities.readonly, opportunities.write,
 * locations/customFields.readonly, medias.write.
 */

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID);
}

const locationId = () => process.env.GHL_LOCATION_ID ?? "";

async function ghl<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.GHL_API_TOKEN}`);
  headers.set("Version", VERSION);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (json as { message?: string | string[] } | null)?.message;
    throw new Error(`GHL ${res.status}: ${Array.isArray(message) ? message.join("; ") : message ?? text.slice(0, 200)}`);
  }
  return json as T;
}

type RawContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  contactName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  address1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
  customFields?: { id: string; value?: unknown; field_value?: unknown }[];
};

export type GhlContact = {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  company: string;
  addressLines: string[];
  custom: Record<string, unknown>;
};

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function toContact(c: RawContact): GhlContact {
  const firstName = c.firstName?.trim() ?? "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.contactName || c.name || "";
  const cityLine = [c.postalCode, c.city].filter(Boolean).join(" ");
  const countryLine = [c.state, c.country].filter(Boolean).join(", ");
  return {
    id: c.id,
    name: titleCase(name),
    firstName: titleCase(firstName),
    email: c.email ?? "",
    phone: c.phone ?? "",
    company: c.companyName ?? "",
    addressLines: [c.address1 ?? "", cityLine, countryLine].map((s) => s.trim()).filter(Boolean),
    custom: Object.fromEntries((c.customFields ?? []).map((f) => [f.id, f.value ?? f.field_value]))
  };
}

export async function findContactByEmail(email: string): Promise<GhlContact | null> {
  const params = new URLSearchParams({ locationId: locationId(), email });
  const data = await ghl<{ contact?: RawContact | null }>(`/contacts/search/duplicate?${params}`);
  if (!data.contact?.id) return null;
  return getContact(data.contact.id); // Duplikat-Suche liefert nicht alle Felder
}

export async function getContact(id: string): Promise<GhlContact | null> {
  try {
    const data = await ghl<{ contact: RawContact }>(`/contacts/${encodeURIComponent(id)}`);
    return toContact(data.contact);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("GHL 404")) return null;
    throw err;
  }
}

export async function searchContacts(q: string): Promise<GhlContact[]> {
  const data = await ghl<{ contacts: RawContact[] }>(`/contacts/search`, {
    method: "POST",
    body: JSON.stringify({ locationId: locationId(), pageLimit: 10, query: q })
  });
  return (data.contacts ?? []).map(toContact);
}

// ── Benutzerdefinierte Felder (über den fieldKey aufgelöst, damit IDs nicht im Code stehen) ──

let fieldCache: { at: number; byKey: Map<string, { id: string; dataType: string }> } | null = null;

async function customFields() {
  if (fieldCache && Date.now() - fieldCache.at < 10 * 60_000) return fieldCache.byKey;
  const data = await ghl<{ customFields: { id: string; fieldKey: string; dataType: string }[] }>(
    `/locations/${locationId()}/customFields?model=all`
  );
  const byKey = new Map(data.customFields.map((f) => [f.fieldKey, { id: f.id, dataType: f.dataType }]));
  fieldCache = { at: Date.now(), byKey };
  return byKey;
}

export async function customValue(contact: GhlContact, fieldKey: string): Promise<unknown> {
  const field = (await customFields()).get(fieldKey);
  return field ? contact.custom[field.id] : undefined;
}

// ── Opportunities ───────────────────────────────────────────

export type GhlOpportunity = {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue: number | null;
  updatedAt: string | null;
};

export async function opportunitiesForContact(contactId: string): Promise<GhlOpportunity[]> {
  const params = new URLSearchParams({ location_id: locationId(), contact_id: contactId, limit: "20" });
  const data = await ghl<{ opportunities: Record<string, unknown>[] }>(`/opportunities/search?${params}`);
  return (data.opportunities ?? []).map((o) => ({
    id: String(o.id),
    name: String(o.name ?? ""),
    pipelineId: String(o.pipelineId ?? ""),
    pipelineStageId: String(o.pipelineStageId ?? ""),
    status: String(o.status ?? ""),
    monetaryValue: typeof o.monetaryValue === "number" ? o.monetaryValue : null,
    updatedAt: (o.updatedAt as string) ?? null
  }));
}

/** Offene Opportunity bevorzugen, sonst die zuletzt geänderte. */
export function pickOpportunity(list: GhlOpportunity[]): GhlOpportunity | null {
  const open = list.filter((o) => o.status === "open");
  const pool = open.length ? open : list;
  return [...pool].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0] ?? null;
}

export type GhlPipeline = { id: string; name: string; stages: { id: string; name: string }[] };

let pipelineCache: { at: number; list: GhlPipeline[] } | null = null;

export async function pipelines(): Promise<GhlPipeline[]> {
  if (pipelineCache && Date.now() - pipelineCache.at < 10 * 60_000) return pipelineCache.list;
  const data = await ghl<{ pipelines: GhlPipeline[] }>(`/opportunities/pipelines?locationId=${locationId()}`);
  pipelineCache = { at: Date.now(), list: data.pipelines };
  return data.pipelines;
}

export async function updateOpportunity(id: string, body: { pipelineStageId?: string; monetaryValue?: number }) {
  await ghl(`/opportunities/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
}

// ── Ablage ──────────────────────────────────────────────────

export async function addNote(contactId: string, body: string): Promise<void> {
  await ghl(`/contacts/${encodeURIComponent(contactId)}/notes`, { method: "POST", body: JSON.stringify({ body }) });
}

/** Lädt eine Datei in die Mediathek der Location. Die zurückgegebene URL ist nicht erratbar, aber ohne Login abrufbar. */
export async function uploadToMedia(file: { name: string; data: Buffer; type: string }): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
  form.append("hosted", "false");
  form.append("name", file.name);
  const data = await ghl<{ fileId: string; url: string }>(`/medias/upload-file`, { method: "POST", body: form });
  return data.url;
}

/**
 * Lädt eine Datei direkt in ein Datei-Feld (FILE_UPLOAD) des Kontakts. Die Datei erscheint dann im Kontakt
 * unter diesem Feld. Gibt null zurück, wenn das Feld nicht existiert.
 */
export async function uploadToContactField(
  contactId: string,
  fieldKey: string,
  file: { name: string; data: Buffer; type: string }
): Promise<string | null> {
  const field = (await customFields()).get(fieldKey);
  if (!field) return null;
  const form = new FormData();
  form.append(`${field.id}_${crypto.randomUUID()}`, new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
  const params = new URLSearchParams({ contactId, locationId: locationId() });
  const data = await ghl<{ uploadedFiles?: Record<string, string> }>(`/forms/upload-custom-files?${params}`, {
    method: "POST",
    body: form
  });
  return Object.values(data.uploadedFiles ?? {})[0] ?? "";
}

export function contactUrl(contactId: string): string {
  return `https://app.gohighlevel.com/v2/location/${locationId()}/contacts/detail/${contactId}`;
}
