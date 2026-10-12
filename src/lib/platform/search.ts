import { sql } from "@/lib/db";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { hasOffertenAccess } from "@/lib/offerten/access";
import { hasSalesAccess } from "@/lib/sales/access";
import * as ghl from "@/lib/sales/ghl";
import { searchItems } from "@/lib/assistant/store";
import { hasAssistentAccess, hasKundenAccess, type PlatformUser } from "./access";
import { callIntegration } from "./integrations";
import type { Target } from "./today";

/** Globale Suche (⌘K): Apps, Kunden, Offerten, E-Mails des Assistenten und Treffer aus angebundenen Apps. */
export type SearchHit = { id: string; title: string; meta?: string; icon?: string; target: Target };
export type SearchGroup = { id: string; title: string; hits: SearchHit[] };

const like = (q: string) => `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

export async function search(user: PlatformUser, q: string, locale: "de" | "en", labels: Record<string, string>): Promise<SearchGroup[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const needle = query.toLocaleLowerCase();
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles);
  const soft = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
    p.catch((err) => (console.warn("Suche:", err instanceof Error ? err.message : err), fallback));
  type QuoteHit = { id: string; number: string; company: string | null; name: string | null; status: string };

  const customerAccess = hasKundenAccess(user.roles) || hasSalesAccess(user.roles);
  const [contacts, quotes, mails, external] = await Promise.all([
    customerAccess && ghl.ghlConfigured() ? soft(ghl.searchContacts(query), []) : Promise.resolve([]),
    hasOffertenAccess(user.roles)
      ? soft<QuoteHit[]>(
          sql<QuoteHit[]>`
            SELECT id, number, recipient->>'company' AS company, recipient->>'name' AS name, status FROM quotes
            WHERE status <> 'discarded' AND (number ILIKE ${like(query)} OR recipient->>'company' ILIKE ${like(query)}
              OR recipient->>'name' ILIKE ${like(query)} OR recipient->>'email' ILIKE ${like(query)})
            ORDER BY updated_at DESC LIMIT 5`.then((rows) => [...rows]),
          []
        )
      : Promise.resolve([] as QuoteHit[]),
    hasAssistentAccess(user.roles) ? soft(searchItems(user.id, query, 5), []) : Promise.resolve([]),
    Promise.all(
      apps
        .filter((a) => a.integrations?.search)
        .map(async (app) => ({ app, list: await callIntegration(app, "search", user, { q: query }, 3000) }))
    )
  ]);

  const groups: SearchGroup[] = [];
  const appHits = apps
    .filter((a) => `${a.name[locale]} ${a.description[locale]}`.toLocaleLowerCase().includes(needle))
    .slice(0, 6)
    .map((a) => ({ id: `app-${a.id}`, title: a.name[locale], meta: a.description[locale], icon: a.icon, target: a.embed ? { app: a.id } : { href: a.url } }));
  if (appHits.length) groups.push({ id: "apps", title: labels.apps, hits: appHits });

  if (contacts.length) {
    groups.push({
      id: "customers",
      title: labels.customers,
      hits: contacts.slice(0, 6).map((c) => ({
        id: `c-${c.id}`,
        title: c.name || c.company || c.email,
        meta: [c.company, c.email].filter(Boolean).join(" · "),
        icon: "Building2",
        target: hasKundenAccess(user.roles) ? { app: "kunden", path: `/kunden/${c.id}` } : { app: "sales", path: `/sales/kontakt/${c.id}` }
      }))
    });
  }
  if (quotes.length) {
    groups.push({
      id: "quotes",
      title: labels.quotes,
      hits: quotes.map((q) => ({ id: `q-${q.id}`, title: q.company || q.name || q.number, meta: `${q.number} · ${labels[`quote_${q.status}`] ?? q.status}`, icon: "FilePen", target: { app: "offerten", path: `/offerten/${q.id}` } }))
    });
  }
  if (mails.length) {
    groups.push({
      id: "mail",
      title: labels.mail,
      hits: mails.map((m) => ({ id: `m-${m.id}`, title: m.subject || m.fromName, meta: [m.fromName, m.summary].filter(Boolean).join(" · "), icon: "Mail", target: { app: "assistent", path: "/assistent" } }))
    });
  }
  for (const { app, list } of external) {
    if (!list?.items.length) continue;
    groups.push({
      id: `app-${app.id}`,
      title: list.title || app.name[locale],
      hits: list.items.slice(0, 5).map((it, i) => ({ id: `${app.id}-${it.id ?? i}`, title: it.title, meta: it.meta, icon: app.icon, target: { app: app.id, path: it.path } }))
    });
  }
  return groups;
}
