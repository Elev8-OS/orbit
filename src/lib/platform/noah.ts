import fs from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { hasOffertenAccess } from "@/lib/offerten/access";
import { hasSalesAccess } from "@/lib/sales/access";
import * as ghl from "@/lib/sales/ghl";
import { loadCustomer } from "@/lib/kunden/service";
import { hasKundenAccess, type PlatformUser } from "./access";
import { loadMyDay, type Target } from "./today";
import { statusOverview } from "./status";

/**
 * Noah: der Assistent in ganz Orbit. Beantwortet Fragen zur Elev8 Suite (Produktwissen aus
 * config/knowledge/elev8.md), kennt die Apps der Person und kann über Werkzeuge nachschauen:
 * Kunden suchen, Kunden-360 zusammenfassen, „Mein Tag“ lesen, Offerten finden, Status prüfen.
 * Werkzeuge gibt es nur, wenn die Person die passende Rolle hat. Noah liest nur, er ändert nichts.
 */
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type NoahLink = { label: string; target: Target };
export type NoahAnswer = { answer: string; links: NoahLink[] };

let knowledge: string | null = null;
async function productKnowledge(): Promise<string> {
  if (knowledge !== null && process.env.NODE_ENV === "production") return knowledge;
  try {
    knowledge = await fs.readFile(path.join(process.cwd(), "config", "knowledge", "elev8.md"), "utf8");
  } catch {
    knowledge = "";
  }
  return knowledge;
}

type Tool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: Record<string, unknown>, links: NoahLink[]) => Promise<unknown>;
};

function tools(user: PlatformUser, locale: "de" | "en"): Tool[] {
  const list: Tool[] = [];
  const customers = hasKundenAccess(user.roles) || hasSalesAccess(user.roles);
  if (customers && ghl.ghlConfigured()) {
    list.push({
      name: "search_customers",
      description: "Sucht Kunden und Interessenten in GHL nach Name, Firma, E-Mail oder Telefon.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: async (input, links) => {
        const found = await ghl.searchContacts(String(input.query ?? ""));
        for (const c of found.slice(0, 3)) {
          links.push({ label: c.company || c.name, target: hasKundenAccess(user.roles) ? { app: "kunden", path: `/kunden/${c.id}` } : { app: "sales", path: `/sales/kontakt/${c.id}` } });
        }
        return found.slice(0, 8).map((c) => ({ id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, tags: c.tags }));
      }
    });
  }
  if (hasKundenAccess(user.roles) && ghl.ghlConfigured()) {
    list.push({
      name: "customer_overview",
      description: "Alles zu einem Kunden (per contact_id aus search_customers): Opportunities, offene Tasks, Offerten, Calls, letzte Notizen und Nachrichten, Support.",
      input_schema: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] },
      run: async (input, links) => {
        const c = await loadCustomer(String(input.contact_id ?? ""), user, locale);
        if (!c) return { error: "not_found" };
        links.push({ label: c.contact.company || c.contact.name, target: { app: "kunden", path: `/kunden/${c.contact.id}` } });
        return {
          contact: c.contact,
          owner: c.owner,
          opportunities: c.opportunities.map((o) => ({ name: o.name, pipeline: o.pipelineName, stage: o.stageName, status: o.status, value: o.value })),
          openTasks: c.tasks.filter((t) => !t.completed).map((t) => ({ title: t.title, due: t.dueDate })),
          quotes: c.quotes,
          calls: c.calls.slice(0, 5).map((x) => ({ date: x.date, title: x.title, summary: x.summary.slice(0, 500) })),
          notes: c.notes.slice(0, 5).map((n) => ({ date: n.date, text: n.body.slice(0, 400) })),
          messages: c.messages.slice(0, 8).map((m) => ({ date: m.at, from: m.direction === "inbound" ? "customer" : "elev8", channel: m.channel, text: m.text.slice(0, 300) })),
          other: c.sections.map((s) => ({ source: s.title, items: s.items.slice(0, 8) }))
        };
      }
    });
  }
  list.push({
    name: "my_day",
    description: "Was heute für die angemeldete Person ansteht: Termine, fällige Aufgaben, Offerten, E-Mail-Entwürfe, Meldungen aus Apps.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const cards = await loadMyDay(user, locale);
      return cards.map((c) => ({ source: c.title, count: c.count, items: c.items.map((i) => `${i.title}${i.meta ? ` (${i.meta})` : ""}`) }));
    }
  });
  if (hasOffertenAccess(user.roles)) {
    list.push({
      name: "search_quotes",
      description: "Sucht Offerten nach Nummer, Firma oder Name des Empfängers.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: async (input, links) => {
        const q = `%${String(input.query ?? "").replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        const rows = await sql<{ id: string; number: string; status: string; outcome: string; company: string | null; name: string | null; sent_at: Date | null; follow_up_at: Date | null }[]>`
          SELECT id, number, status, outcome, recipient->>'company' AS company, recipient->>'name' AS name, sent_at, follow_up_at FROM quotes
          WHERE status <> 'discarded' AND (number ILIKE ${q} OR recipient->>'company' ILIKE ${q} OR recipient->>'name' ILIKE ${q})
          ORDER BY updated_at DESC LIMIT 6`;
        for (const r of rows.slice(0, 3)) links.push({ label: r.number, target: { app: "offerten", path: `/offerten/${r.id}` } });
        return rows;
      }
    });
  }
  if (user.admin) {
    list.push({
      name: "service_status",
      description: "Zustand aller überwachten Dienste und Apps (Statusseite).",
      input_schema: { type: "object", properties: {} },
      run: async (_input, links) => {
        links.push({ label: locale === "en" ? "Status page" : "Statusseite", target: { href: "/admin/status" } });
        return (await statusOverview()).map((s) => ({ name: s.name, state: s.state, message: s.message, uptime30d: s.uptime }));
      }
    });
  }
  return list;
}

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

async function call(body: Record<string, unknown>): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000)
  });
  const json = (await res.json().catch(() => null)) as { content?: Block[]; stop_reason?: string; error?: { message?: string } } | null;
  if (!res.ok || !json?.content) throw new Error(`Claude-API: ${json?.error?.message ?? res.status}`);
  return { content: json.content, stop_reason: json.stop_reason ?? "end_turn" };
}

export const noahConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function askNoah(user: PlatformUser, locale: "de" | "en", history: ChatMessage[], context?: { app?: string | null }): Promise<NoahAnswer> {
  const t = await getTranslations("platform.noah");
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles);
  const available = tools(user, locale);
  const links: NoahLink[] = [];
  const today = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", dateStyle: "full" }).format(new Date());
  const current = context?.app ? apps.find((a) => a.id === context.app) : null;

  const system = `Du bist Noah, der Assistent in Orbit, der Arbeitsplattform von Elev8 (Software für Ferienwohnungs- und Hotelverwaltung, Elev8 Suite).
Du hilfst ${user.name} (${user.email}) bei der Arbeit. Heute ist ${today}.
Antworte auf ${locale === "en" ? "Englisch" : "Deutsch (Schweiz, ohne ß, mit Du)"}, kurz und konkret. Einfache Formatierung: Absätze, Aufzählungen mit "- ", **fett** sparsam.
Erfinde nichts. Wenn du etwas nicht weisst oder ein Werkzeug nichts liefert, sag es und sag, wo man nachschauen kann.
Du kannst nur lesen, nichts ändern. Für Aktionen verweise auf die passende App in Orbit.
${current ? `Die Person hat gerade die App "${current.name.de}" offen.` : ""}

Apps dieser Person in Orbit:
${apps.map((a) => `- ${a.name[locale]}: ${a.description[locale]}`).join("\n") || "- keine"}

Produktwissen zur Elev8 Suite (Quelle für Produktfragen):
${(await productKnowledge()).slice(0, 30_000)}`;

  const messages: { role: "user" | "assistant"; content: string | Block[] | { type: string; tool_use_id: string; content: string }[] }[] = history
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const model = process.env.NOAH_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  for (let round = 0; round < 5; round++) {
    const res = await call({
      model,
      max_tokens: 1500,
      system,
      messages,
      ...(available.length ? { tools: available.map(({ run: _run, ...def }) => def) } : {})
    });
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (!uses.length || res.stop_reason !== "tool_use") {
      const answer = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
      return { answer: answer || t("noAnswer"), links: dedupe(links) };
    }
    messages.push({ role: "assistant", content: res.content });
    const results = await Promise.all(
      uses.map(async (u) => {
        const tool = available.find((x) => x.name === u.name);
        let content: string;
        try {
          content = JSON.stringify(tool ? await tool.run(u.input ?? {}, links) : { error: "unknown_tool" }).slice(0, 30_000);
        } catch (err) {
          content = JSON.stringify({ error: err instanceof Error ? err.message : "failed" });
        }
        return { type: "tool_result", tool_use_id: u.id ?? "", content };
      })
    );
    messages.push({ role: "user", content: results });
  }
  return { answer: t("tooLong"), links: dedupe(links) };
}

function dedupe(links: NoahLink[]): NoahLink[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = JSON.stringify(l.target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}
