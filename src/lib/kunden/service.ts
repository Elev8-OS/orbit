import { z } from "zod";
import { sql } from "@/lib/db";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import * as ghl from "@/lib/sales/ghl";
import { loadContact, type ContactView } from "@/lib/sales/service";
import { contactMessages, type HistoryItem } from "@/lib/offerten/ghl";
import { callClaudeTool, claudeConfigured } from "@/lib/offerten/claude";
import { callIntegration, type IntegrationItem } from "@/lib/platform/integrations";
import type { PlatformUser } from "@/lib/platform/access";

/**
 * Kunden-360: alles zu einem Kunden auf einer Seite.
 * Quelle der Wahrheit bleibt GHL (Kontakt, Opportunities, Tasks, Termine, Notizen, Nachrichten).
 * Dazu kommen Calls (Fireflies) und Offerten aus Orbit sowie alles, was andere Apps über ihre
 * Kunden-Schnittstelle liefern (z.B. Support-Tickets aus dem Support Bot, siehe docs/INTEGRATION.md).
 */
export type TimelineEntry = {
  id: string;
  at: string;
  kind: "note" | "message" | "call" | "quote" | "meeting" | "task";
  title: string;
  text?: string;
  meta?: string;
  direction?: "inbound" | "outbound";
  target?: { app: string; path?: string };
};

export type AppSection = { appId: string; appName: string; title: string; count?: number; items: IntegrationItem[] };

export type Customer = ContactView & {
  messages: HistoryItem[];
  timeline: TimelineEntry[];
  sections: AppSection[];
  owner: string | null;
};

export async function loadCustomer(contactId: string, user: PlatformUser, locale: "de" | "en"): Promise<Customer | null> {
  const base = await loadContact(contactId);
  if (!base) return null;
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles).filter((a) => a.integrations?.customer);
  const [messages, users, sections] = await Promise.all([
    contactMessages(contactId, 25).catch(() => [] as HistoryItem[]),
    ghl.listUsers().catch(() => []),
    Promise.all(
      apps.map(async (app) => {
        const list = await callIntegration(app, "customer", user, { contactId, email: base.contact.email, phone: base.contact.phone, company: base.contact.company });
        return list && (list.items.length || list.count)
          ? ({ appId: app.id, appName: app.name[locale], title: list.title || app.name[locale], count: list.count, items: list.items } as AppSection)
          : null;
      })
    )
  ]);

  const timeline: TimelineEntry[] = [
    ...base.notes.map((n) => ({ id: `n-${n.id}`, at: n.date, kind: "note" as const, title: "", text: n.body })),
    ...messages.map((m, i) => ({
      id: `m-${i}`,
      at: m.at,
      kind: "message" as const,
      title: m.channel ?? "",
      text: m.text,
      direction: m.direction === "inbound" ? ("inbound" as const) : ("outbound" as const)
    })),
    ...base.calls.map((c) => ({
      id: `c-${c.meetingId}`,
      at: c.date ?? "",
      kind: "call" as const,
      title: c.title,
      text: c.summary,
      target: c.quoteId ? { app: "offerten", path: `/offerten/${c.quoteId}` } : undefined
    })),
    ...base.quotes.map((q) => ({
      id: `q-${q.id}`,
      at: q.sentAt ?? q.updatedAt,
      kind: "quote" as const,
      title: q.number,
      meta: q.status,
      target: { app: "offerten", path: `/offerten/${q.id}` }
    })),
    ...base.events.map((e) => ({ id: `e-${e.id}`, at: e.start, kind: "meeting" as const, title: e.title, meta: e.status })),
    ...base.tasks
      .filter((t) => t.completed)
      .map((t) => ({ id: `t-${t.id}`, at: t.dueDate ?? "", kind: "task" as const, title: t.title, text: t.body }))
  ]
    .filter((e) => e.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 80);

  const owner = base.contact.assignedTo ? users.find((u) => u.id === base.contact.assignedTo)?.name ?? null : null;
  return { ...base, messages, timeline, sections: sections.filter((s): s is AppSection => s !== null), owner };
}

export async function searchCustomers(q: string): Promise<ghl.SalesContact[]> {
  if (!ghl.ghlConfigured() || q.trim().length < 2) return [];
  return ghl.searchContacts(q.trim());
}

// ── Briefing von Noah ───────────────────────────────────────────────

export const briefingSchema = z.object({
  headline: z.string().max(300),
  status: z.string().max(600),
  openPoints: z.array(z.string().max(300)).max(8).default([]),
  risks: z.array(z.string().max(300)).max(5).default([]),
  nextStep: z.string().max(400),
  mood: z.enum(["positive", "neutral", "critical", "unknown"]).default("unknown")
});
export type Briefing = z.infer<typeof briefingSchema> & { createdAt: string };

const TOOL = {
  name: "customer_briefing",
  description: "Kurzbriefing zu einem Kunden für das Elev8-Team.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Ein Satz: wer der Kunde ist und wo er steht." },
      status: { type: "string", description: "2 bis 3 Sätze zum aktuellen Stand der Beziehung." },
      openPoints: { type: "array", items: { type: "string" }, description: "Offene Punkte, Zusagen, Fragen des Kunden." },
      risks: { type: "array", items: { type: "string" }, description: "Risiken oder Unzufriedenheit, nur wenn belegt." },
      nextStep: { type: "string", description: "Der sinnvollste nächste Schritt für das Team." },
      mood: { type: "string", enum: ["positive", "neutral", "critical", "unknown"] }
    },
    required: ["headline", "status", "openPoints", "risks", "nextStep", "mood"]
  }
};

const MAX_AGE_HOURS = 12;

export async function getBriefing(contactId: string, locale: "de" | "en"): Promise<Briefing | null> {
  const [row] = await sql<{ briefing: unknown; created_at: Date; locale: string }[]>`
    SELECT briefing, created_at, locale FROM customer_briefings WHERE contact_id = ${contactId}
      AND created_at > now() - make_interval(hours => ${MAX_AGE_HOURS})`;
  if (!row || row.locale !== locale) return null;
  const parsed = briefingSchema.safeParse(row.briefing);
  return parsed.success ? { ...parsed.data, createdAt: row.created_at.toISOString() } : null;
}

export async function createBriefing(customer: Customer, locale: "de" | "en", by: string): Promise<Briefing> {
  if (!claudeConfigured()) throw new Error("claude_not_configured");
  const c = customer.contact;
  const lines = (title: string, items: string[]) => (items.length ? `## ${title}\n${items.join("\n")}` : "");
  const user = [
    `# Kunde\n${c.name}${c.company ? ` (${c.company})` : ""}\nE-Mail: ${c.email || "–"} · Telefon: ${c.phone || "–"}\nTags: ${c.tags.join(", ") || "–"}\nBetreut von: ${customer.owner ?? "–"}`,
    lines("Opportunities", customer.opportunities.map((o) => `- ${o.name}: ${o.pipelineName} / ${o.stageName}, Status ${o.status}, Wert ${o.value ?? "–"}`)),
    lines("Offene Tasks", customer.tasks.filter((t) => !t.completed).map((t) => `- ${t.title} (fällig ${t.dueDate?.slice(0, 10) ?? "–"})`)),
    lines("Offerten", customer.quotes.map((q) => `- ${q.number}: ${q.status}${q.sentAt ? `, versendet ${q.sentAt.slice(0, 10)}` : ""}`)),
    lines("Calls", customer.calls.map((x) => `- ${x.date?.slice(0, 10) ?? ""} ${x.title}: ${x.summary.slice(0, 600)}`)),
    lines("Notizen", customer.notes.slice(0, 8).map((n) => `- ${n.date.slice(0, 10)}: ${n.body.slice(0, 500)}`)),
    lines(
      "Nachrichten",
      customer.messages.slice(0, 15).map((m) => `- ${m.at.slice(0, 10)} ${m.direction === "inbound" ? "Kunde" : "Elev8"} (${m.channel}): ${m.text.slice(0, 400)}`)
    ),
    ...customer.sections.map((s) => lines(s.title, s.items.map((i) => `- ${i.title}${i.meta ? ` (${i.meta})` : ""}`)))
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callClaudeTool({
    system: `Du bist Noah, der Assistent im Team von Elev8 (Software für Ferienwohnungs- und Hotelverwaltung). Du schreibst ein knappes, sachliches Kundenbriefing für Kolleginnen und Kollegen aus Sales, Onboarding und Support. Nur belegte Fakten aus den Daten, nichts erfinden. Schreibe auf ${locale === "en" ? "Englisch" : "Deutsch (Schweiz, ohne ß)"}.`,
    user,
    tool: TOOL,
    maxTokens: 1500,
    timeoutMs: 90_000
  });
  const parsed = briefingSchema.safeParse(raw);
  if (!parsed.success) throw new Error("briefing_invalid");
  await sql`
    INSERT INTO customer_briefings (contact_id, locale, briefing, created_by) VALUES (${c.id}, ${locale}, ${sql.json(parsed.data as never)}, ${by})
    ON CONFLICT (contact_id) DO UPDATE SET locale = EXCLUDED.locale, briefing = EXCLUDED.briefing, created_by = EXCLUDED.created_by, created_at = now()`;
  return { ...parsed.data, createdAt: new Date().toISOString() };
}
