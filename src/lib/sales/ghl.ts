/**
 * GoHighLevel-Anbindung der Sales-App (API v2). Nutzt denselben Private Integration Token wie die Offerten
 * (GHL_API_TOKEN, GHL_LOCATION_ID). Zusätzlich nötige Scopes:
 *   users.readonly, calendars.readonly, calendars/events.readonly, locations/tasks.readonly
 * (contacts.*, opportunities.* hat der Token schon für die Offerten).
 *
 * Nichts davon wird gespeichert: Orbit liest bei jedem Aufruf live und schreibt Änderungen direkt zurück.
 */

const BASE = () => process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const CALENDAR_VERSION = "2021-04-15";

export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID);
}

export const locationId = () => process.env.GHL_LOCATION_ID ?? "";

async function ghl<T>(path: string, init: RequestInit & { version?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.GHL_API_TOKEN}`);
  headers.set("Version", init.version ?? VERSION);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE()}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
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
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Kleiner Zeit-Cache für Daten, die sich selten ändern (User, Pipelines, Kontaktnamen). */
function cached<T>(ttlMs: number, load: () => Promise<T>) {
  let entry: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (!entry || Date.now() - entry.at > ttlMs) {
      const value = load();
      entry = { at: Date.now(), value };
      value.catch(() => {
        entry = null;
      });
    }
    return entry.value;
  };
}

// ── User ────────────────────────────────────────────────────

export type GhlUser = { id: string; name: string; email: string };

export const listUsers = cached(10 * 60_000, async (): Promise<GhlUser[]> => {
  const data = await ghl<{ users?: Record<string, unknown>[] }>(`/users/?locationId=${locationId()}`);
  return (data.users ?? [])
    .filter((u) => !u.deleted)
    .map((u) => ({
      id: str(u.id),
      name: str(u.name) || [str(u.firstName), str(u.lastName)].filter(Boolean).join(" ") || str(u.email),
      email: str(u.email).toLowerCase()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export async function userByEmail(email: string): Promise<GhlUser | null> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  return (await listUsers()).find((u) => u.email === wanted) ?? null;
}

// ── Kontakte ────────────────────────────────────────────────

export type SalesContact = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  assignedTo: string | null;
  tags: string[];
};

function toContact(c: Record<string, unknown>): SalesContact {
  const name = [str(c.firstName), str(c.lastName)].filter(Boolean).join(" ").trim() || str(c.contactName) || str(c.name);
  return {
    id: str(c.id),
    name: titleCase(name),
    company: str(c.companyName),
    email: str(c.email).toLowerCase(),
    phone: str(c.phone),
    assignedTo: str(c.assignedTo) || null,
    tags: Array.isArray(c.tags) ? c.tags.map(str) : []
  };
}

const contactCache = new Map<string, { at: number; value: SalesContact | null }>();

export async function getContact(id: string, fresh = false): Promise<SalesContact | null> {
  const hit = contactCache.get(id);
  if (!fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
  try {
    const data = await ghl<{ contact: Record<string, unknown> }>(`/contacts/${encodeURIComponent(id)}`);
    const value = toContact(data.contact);
    contactCache.set(id, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("GHL 404")) {
      contactCache.set(id, { at: Date.now(), value: null });
      return null;
    }
    throw err;
  }
}

export async function findContactByEmail(email: string): Promise<SalesContact | null> {
  const params = new URLSearchParams({ locationId: locationId(), email });
  const data = await ghl<{ contact?: Record<string, unknown> | null }>(`/contacts/search/duplicate?${params}`);
  const id = data.contact?.id ? str(data.contact.id) : "";
  return id ? getContact(id) : null;
}

export async function searchContacts(q: string): Promise<SalesContact[]> {
  const data = await ghl<{ contacts?: Record<string, unknown>[] }>(`/contacts/search`, {
    method: "POST",
    body: JSON.stringify({ locationId: locationId(), pageLimit: 8, query: q })
  });
  return (data.contacts ?? []).map(toContact);
}

export function contactUrl(contactId: string): string {
  return `https://app.gohighlevel.com/v2/location/${locationId()}/contacts/detail/${contactId}`;
}

// ── Termine (GHL-Kalender) ──────────────────────────────────

export type GhlEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  contactId: string | null;
  meetingUrl: string | null;
};

function toEvent(e: Record<string, unknown>): GhlEvent {
  const address = str(e.address);
  return {
    id: str(e.id),
    title: str(e.title),
    start: str(e.startTime),
    end: str(e.endTime),
    status: str(e.appointmentStatus || e.status).toLowerCase(),
    contactId: str(e.contactId) || null,
    meetingUrl: /^https?:\/\//.test(address) ? address : null
  };
}

const CANCELLED = new Set(["cancelled", "canceled", "invalid", "noshow"]);

/** Termine eines Users im Zeitraum, ohne abgesagte, nach Beginn sortiert. */
export async function eventsForUser(userId: string, from: Date, to: Date): Promise<GhlEvent[]> {
  const params = new URLSearchParams({
    locationId: locationId(),
    userId,
    startTime: String(from.getTime()),
    endTime: String(to.getTime())
  });
  const data = await ghl<{ events?: Record<string, unknown>[] }>(`/calendars/events?${params}`, { version: CALENDAR_VERSION });
  return (data.events ?? [])
    .filter((e) => !e.deleted)
    .map(toEvent)
    .filter((e) => !CANCELLED.has(e.status))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function eventsForContact(contactId: string): Promise<GhlEvent[]> {
  const data = await ghl<{ events?: Record<string, unknown>[] }>(`/contacts/${encodeURIComponent(contactId)}/appointments`);
  return (data.events ?? []).map(toEvent).sort((a, b) => b.start.localeCompare(a.start));
}

// ── Tasks (Follow-ups) ──────────────────────────────────────

export type GhlTask = {
  id: string;
  contactId: string;
  contactName: string;
  title: string;
  body: string;
  dueDate: string | null;
  completed: boolean;
  assignedTo: string | null;
};

function toTask(t: Record<string, unknown>, contactId?: string): GhlTask {
  const details = (t.contactDetails ?? t.contact ?? {}) as Record<string, unknown>;
  const contactName = [str(details.firstName), str(details.lastName)].filter(Boolean).join(" ") || str(details.name);
  return {
    id: str(t.id ?? t._id),
    contactId: str(t.contactId) || contactId || "",
    contactName: titleCase(contactName),
    title: str(t.title),
    body: str(t.body ?? t.description),
    dueDate: str(t.dueDate) || null,
    completed: Boolean(t.completed),
    assignedTo: str(t.assignedTo) || null
  };
}

/** Offene Tasks eines Users über alle Kontakte (Task-Suche der Location). */
export async function openTasksForUser(userId: string): Promise<GhlTask[]> {
  const all: GhlTask[] = [];
  for (let skip = 0; skip < 500; skip += 100) {
    const data = await ghl<{ tasks?: Record<string, unknown>[] }>(`/locations/${locationId()}/tasks/search`, {
      method: "POST",
      body: JSON.stringify({ completed: false, assignedTo: [userId], limit: 100, skip })
    });
    const page = (data.tasks ?? []).map((t) => toTask(t));
    all.push(...page);
    if (page.length < 100) break;
  }
  // Manche Accounts ignorieren den Filter: hier nochmals absichern
  return all.filter((t) => !t.completed && (!t.assignedTo || t.assignedTo === userId));
}

export async function tasksForContact(contactId: string): Promise<GhlTask[]> {
  const data = await ghl<{ tasks?: Record<string, unknown>[] }>(`/contacts/${encodeURIComponent(contactId)}/tasks`);
  return (data.tasks ?? []).map((t) => toTask(t, contactId));
}

export async function createTask(
  contactId: string,
  task: { title: string; body: string; dueDate: string; assignedTo: string }
): Promise<GhlTask> {
  const data = await ghl<{ task?: Record<string, unknown> }>(`/contacts/${encodeURIComponent(contactId)}/tasks`, {
    method: "POST",
    body: JSON.stringify({ ...task, completed: false })
  });
  return toTask(data.task ?? {}, contactId);
}

export async function completeTask(contactId: string, taskId: string): Promise<void> {
  await ghl(`/contacts/${encodeURIComponent(contactId)}/tasks/${encodeURIComponent(taskId)}/completed`, {
    method: "PUT",
    body: JSON.stringify({ completed: true })
  });
}

export async function rescheduleTask(contactId: string, taskId: string, dueDate: string): Promise<void> {
  await ghl(`/contacts/${encodeURIComponent(contactId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    body: JSON.stringify({ dueDate })
  });
}

// ── Notizen ─────────────────────────────────────────────────

export type GhlNote = { id: string; body: string; date: string };

export async function notesForContact(contactId: string): Promise<GhlNote[]> {
  const data = await ghl<{ notes?: Record<string, unknown>[] }>(`/contacts/${encodeURIComponent(contactId)}/notes`);
  return (data.notes ?? [])
    .map((n) => ({ id: str(n.id), body: str(n.body), date: str(n.dateAdded ?? n.createdAt) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function addNote(contactId: string, body: string): Promise<void> {
  await ghl(`/contacts/${encodeURIComponent(contactId)}/notes`, { method: "POST", body: JSON.stringify({ body }) });
}

// ── Opportunities ───────────────────────────────────────────

export type SalesOpportunity = {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  status: string;
  value: number | null;
  assignedTo: string | null;
  contactId: string | null;
  contactName: string;
  company: string;
  lastActivity: string | null;
};

function toOpportunity(o: Record<string, unknown>): SalesOpportunity {
  const contact = (o.contact ?? {}) as Record<string, unknown>;
  const dates = [o.lastStageChangeAt, o.lastStatusChangeAt, o.updatedAt, o.createdAt].map(str).filter(Boolean).sort();
  return {
    id: str(o.id),
    name: str(o.name),
    pipelineId: str(o.pipelineId),
    stageId: str(o.pipelineStageId),
    status: str(o.status),
    value: num(o.monetaryValue),
    assignedTo: str(o.assignedTo) || null,
    contactId: str(contact.id ?? o.contactId) || null,
    contactName: titleCase(str(contact.name)),
    company: str(contact.companyName),
    lastActivity: dates[dates.length - 1] ?? null
  };
}

/** Offene Opportunities eines Users (max. 500). */
export async function openOpportunitiesForUser(userId: string): Promise<SalesOpportunity[]> {
  const all: SalesOpportunity[] = [];
  let cursor: { startAfter: string; startAfterId: string } | null = null;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ location_id: locationId(), assigned_to: userId, status: "open", limit: "100" });
    if (cursor) {
      params.set("startAfter", cursor.startAfter);
      params.set("startAfterId", cursor.startAfterId);
    }
    const data: { opportunities?: Record<string, unknown>[]; meta?: Record<string, unknown> } = await ghl(
      `/opportunities/search?${params}`
    );
    const list = (data.opportunities ?? []).map(toOpportunity);
    all.push(...list);
    const next = data.meta ?? {};
    if (list.length < 100 || !next.startAfterId) break;
    cursor = { startAfter: str(next.startAfter), startAfterId: str(next.startAfterId) };
  }
  return all.filter((o) => o.assignedTo === userId);
}

export async function opportunitiesForContact(contactId: string): Promise<SalesOpportunity[]> {
  const params = new URLSearchParams({ location_id: locationId(), contact_id: contactId, limit: "20" });
  const data = await ghl<{ opportunities?: Record<string, unknown>[] }>(`/opportunities/search?${params}`);
  return (data.opportunities ?? []).map(toOpportunity);
}

export async function getOpportunity(id: string): Promise<SalesOpportunity | null> {
  try {
    const data = await ghl<{ opportunity: Record<string, unknown> }>(`/opportunities/${encodeURIComponent(id)}`);
    return toOpportunity(data.opportunity);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("GHL 404")) return null;
    throw err;
  }
}

export async function moveOpportunity(id: string, body: { pipelineStageId?: string; status?: "won" | "lost" | "open" }) {
  await ghl(`/opportunities/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
}

export type GhlPipeline = { id: string; name: string; stages: { id: string; name: string }[] };

export const listPipelines = cached(10 * 60_000, async (): Promise<GhlPipeline[]> => {
  const data = await ghl<{ pipelines?: { id: string; name: string; stages?: { id: string; name: string }[] }[] }>(
    `/opportunities/pipelines?locationId=${locationId()}`
  );
  return (data.pipelines ?? []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages ?? []).map((s) => ({ id: s.id, name: s.name })) }));
});

export function opportunityUrl(id: string): string {
  return `https://app.gohighlevel.com/v2/location/${locationId()}/opportunities/list?opportunityId=${id}`;
}
