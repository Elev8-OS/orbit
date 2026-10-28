import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { hasSalesAccess, SALES_ADMIN_ROLE } from "@/lib/sales/access";
import { ghlConfigured } from "@/lib/sales/ghl";
import { loadToday, resolveViewer, validTimeZone } from "@/lib/sales/service";
import { hasOffertenAccess } from "@/lib/offerten/access";
import * as assistant from "@/lib/assistant/store";
import { oauthConfigured } from "@/lib/assistant/oauth";
import { hasRadarAccess, radarEnabled } from "@/lib/radar/access";
import { radarStrings } from "@/lib/radar/i18n";
import * as radar from "@/lib/radar/store";
import { hasAssistentAccess, type PlatformUser } from "./access";
import { callIntegration } from "./integrations";
import { openIncidents } from "./status";

/**
 * „Mein Tag“: das Wichtigste aus allen Apps auf der Startseite.
 * Jede Quelle liefert eine Karte; Quellen, die nichts zu sagen haben oder für die die Person keine Rolle hat,
 * fallen weg. Jede Quelle hat ein Zeitlimit, damit eine langsame App die Startseite nicht aufhält.
 */
export type Target = { app: string; path?: string } | { href: string };
export type TodayItem = { id: string; title: string; meta?: string; tone?: "default" | "warning" | "danger" | "success"; target?: Target };
export type TodayCard = {
  id: string;
  title: string;
  icon: string;
  count?: number;
  countLabel?: string;
  items: TodayItem[];
  empty: string;
  action?: { label: string; target: Target };
  error?: string;
};

const TIMEOUT_MS = 6000;
const withTimeout = <T,>(p: Promise<T>, ms = TIMEOUT_MS) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

function timeIn(iso: string, tz: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dateIn(iso: string, tz: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso));
}

async function salesCard(user: PlatformUser, locale: string, tz: string): Promise<TodayCard | null> {
  if (!hasSalesAccess(user.roles) || !ghlConfigured()) return null;
  const t = await getTranslations("platform.today.sales");
  const viewer = await resolveViewer({ id: user.id, name: user.name, email: user.email, isManager: user.admin || user.roles.includes(SALES_ADMIN_ROLE) });
  if (!viewer.ok) return null;
  const data = await loadToday(viewer.viewer, tz);
  const dueTasks = data.tasks.filter((x) => x.bucket !== "soon");
  const meetings = data.events.filter((e) => e.day === "today");
  const items: TodayItem[] = [
    ...meetings.slice(0, 4).map((e) => ({
      id: `e-${e.id}`,
      title: e.contactName || e.company || e.title,
      meta: `${timeIn(e.start, tz, locale)} · ${e.title}`,
      target: e.contactId ? { app: "kunden", path: `/kunden/${e.contactId}` } : { app: "sales", path: "/sales" }
    })),
    ...dueTasks.slice(0, 5).map((x) => ({
      id: `t-${x.id}`,
      title: x.title,
      meta: [x.contactName, x.dueDate ? (x.bucket === "overdue" ? t("overdue", { date: dateIn(x.dueDate, tz, locale) }) : t("dueToday")) : null]
        .filter(Boolean)
        .join(" · "),
      tone: x.bucket === "overdue" ? ("danger" as const) : ("default" as const),
      target: { app: "sales", path: "/sales" }
    }))
  ];
  if (data.calls.length) {
    items.push({ id: "calls", title: t("calls", { count: data.calls.length }), tone: "warning", target: { app: "sales", path: "/sales" } });
  }
  return {
    id: "sales",
    title: t("title"),
    icon: "Target",
    count: dueTasks.length + meetings.length,
    countLabel: t("count", { meetings: meetings.length, tasks: dueTasks.length }),
    items,
    empty: t("empty"),
    action: { label: t("open"), target: { app: "sales", path: "/sales" } },
    error: data.errors.length ? t("partial") : undefined
  };
}

async function offertenCard(user: PlatformUser, locale: string, tz: string): Promise<TodayCard | null> {
  if (!hasOffertenAccess(user.roles)) return null;
  const t = await getTranslations("platform.today.offerten");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const [drafts, followUps] = await Promise.all([
    sql<{ id: string; number: string; company: string | null; name: string | null; updated_at: Date }[]>`
      SELECT id, number, recipient->>'company' AS company, recipient->>'name' AS name, updated_at FROM quotes
      WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 4`,
    sql<{ id: string; number: string; company: string | null; name: string | null; follow_up_at: Date }[]>`
      SELECT id, number, recipient->>'company' AS company, recipient->>'name' AS name, follow_up_at FROM quotes
      WHERE status = 'sent' AND outcome = 'open' AND follow_up_at <= ${today}::date ORDER BY follow_up_at ASC LIMIT 4`
  ]);
  if (!drafts.length && !followUps.length) return null;
  return {
    id: "offerten",
    title: t("title"),
    icon: "FilePen",
    count: drafts.length + followUps.length,
    items: [
      ...followUps.map((q) => ({
        id: `f-${q.id}`,
        title: q.company || q.name || q.number,
        meta: t("followUp", { number: q.number }),
        tone: "warning" as const,
        target: { app: "offerten", path: `/offerten/${q.id}` }
      })),
      ...drafts.map((q) => ({
        id: `d-${q.id}`,
        title: q.company || q.name || q.number,
        meta: t("draft", { number: q.number, date: dateIn(q.updated_at.toISOString(), tz, locale) }),
        target: { app: "offerten", path: `/offerten/${q.id}` }
      }))
    ],
    empty: t("empty"),
    action: { label: t("open"), target: { app: "offerten", path: "/offerten" } }
  };
}

async function assistantCard(user: PlatformUser): Promise<TodayCard | null> {
  if (!hasAssistentAccess(user.roles)) return null;
  const t = await getTranslations("platform.today.assistant");
  const account = await assistant.getAccount(user.id);
  if (!account) {
    if (!oauthConfigured()) return null;
    return {
      id: "assistant",
      title: t("title"),
      icon: "Mail",
      items: [],
      empty: t("notConnected"),
      action: { label: t("connect"), target: { app: "assistent", path: "/assistent" } }
    };
  }
  const [c, open] = await Promise.all([assistant.counts(user.id), assistant.listItems(user.id, "open", 4)]);
  return {
    id: "assistant",
    title: t("title"),
    icon: "Mail",
    count: c.open,
    countLabel: t("count", { count: c.open, high: c.high }),
    items: open.map((i) => ({
      id: `a-${i.id}`,
      title: i.subject || i.fromName,
      meta: [i.fromName, i.summary].filter(Boolean).join(" · "),
      tone: i.priority === "high" ? ("danger" as const) : ("default" as const),
      target: { app: "assistent", path: "/assistent" }
    })),
    empty: account.lastError === "reconnect" ? t("reconnect") : t("empty"),
    action: { label: t("open"), target: { app: "assistent", path: "/assistent" } },
    error: account.lastError === "reconnect" ? t("reconnect") : undefined
  };
}

/**
 * Radar: was die Quellen der Person (Slack, später mehr) an Relevantem für Elev8 gebracht haben.
 * Ein Klick öffnet den Eintrag im Radar; dort steht der Link zum Originalbeitrag.
 * Ohne Verbindung und ohne Lauf gibt es keine Karte.
 */
async function radarCard(user: PlatformUser, locale: "de" | "en", tz: string): Promise<TodayCard | null> {
  if (!radarEnabled() || !hasRadarAccess(user.roles)) return null;
  const s = radarStrings(locale);
  const [today, run] = await Promise.all([radar.todayItems(user.id, 6), radar.lastRun(user.id)]);
  if (!today.total && !run) return null;
  const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
  return {
    id: "radar",
    title: s.cardTitle,
    icon: "Radar",
    count: today.total,
    countLabel: today.high ? s.cardCount(today.total, today.high) : undefined,
    items: today.items.map((i) => {
      const who = [i.channel, i.author].filter(Boolean).join(" · ");
      return {
        id: `r-${i.id}`,
        title: i.title || cut(i.summary, 80),
        meta: i.summary && i.title ? `${who} · ${cut(i.summary, 140)}` : who,
        tone: i.relevance === "high" ? ("warning" as const) : ("default" as const),
        target: { app: "radar", path: `/radar?id=${i.id}` }
      };
    }),
    empty: s.cardEmpty(run ? timeIn(run.finishedAt ?? run.startedAt, tz, locale) : "–"),
    action: { label: s.cardOpen, target: { app: "radar", path: "/radar" } },
    error: run?.error ? s.runError : undefined
  };
}

async function adminCard(user: PlatformUser, locale: "de" | "en"): Promise<TodayCard | null> {
  if (!user.admin) return null;
  const t = await getTranslations("platform.today.admin");
  const config = await loadAppsConfig();
  const names = new Map(config.apps.map((a) => [a.id, a.name]));
  const [requests, incidents] = await Promise.all([
    sql<{ id: string; user_name: string | null; user_email: string | null; app_id: string }[]>`
      SELECT id, user_name, user_email, app_id FROM access_requests WHERE status = 'open' ORDER BY created_at DESC LIMIT 5`,
    openIncidents().catch(() => [])
  ]);
  if (!requests.length && !incidents.length) return null;
  return {
    id: "admin",
    title: t("title"),
    icon: "ShieldCheck",
    count: requests.length + incidents.length,
    items: [
      ...incidents.map((i) => ({
        id: `i-${i.id}`,
        title: i.serviceName,
        meta: i.message ?? t("down"),
        tone: "danger" as const,
        target: { href: "/admin/status" }
      })),
      ...requests.map((r) => ({
        id: `r-${r.id}`,
        title: r.user_name || r.user_email || "?",
        meta: t("request", { app: names.get(r.app_id)?.[locale] ?? r.app_id }),
        target: { href: "/admin/zugriffe" }
      }))
    ],
    empty: "",
    action: { label: t("open"), target: { href: "/admin" } }
  };
}

async function integrationCards(user: PlatformUser, locale: "de" | "en"): Promise<TodayCard[]> {
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles).filter((a) => a.integrations?.today);
  const results = await Promise.all(apps.map(async (app) => ({ app, list: await callIntegration(app, "today", user) })));
  return results
    .filter((r) => r.list && (r.list.items.length || r.list.count))
    .map(({ app, list }) => ({
      id: `app-${app.id}`,
      title: list!.title || app.name[locale],
      icon: app.icon,
      count: list!.count ?? list!.items.length,
      items: list!.items.slice(0, 6).map((it, i) => ({
        id: it.id ?? `${app.id}-${i}`,
        title: it.title,
        meta: it.meta,
        tone: it.tone,
        target: { app: app.id, path: it.path }
      })),
      empty: "",
      action: { label: app.name[locale], target: { app: app.id } }
    }));
}

export async function loadMyDay(user: PlatformUser, locale: "de" | "en"): Promise<TodayCard[]> {
  const tz = validTimeZone((await cookies()).get("SALES_TZ")?.value);
  const t = await getTranslations("platform.today");
  const sources: [string, () => Promise<TodayCard | TodayCard[] | null>][] = [
    ["assistant", () => assistantCard(user)],
    ["radar", () => radarCard(user, locale, tz)],
    ["sales", () => salesCard(user, locale, tz)],
    ["offerten", () => offertenCard(user, locale, tz)],
    ["apps", () => integrationCards(user, locale)],
    ["admin", () => adminCard(user, locale)]
  ];
  const settled = await Promise.all(
    sources.map(async ([id, load]) => {
      try {
        return await withTimeout(load());
      } catch (err) {
        console.warn(`Mein Tag: Quelle ${id} nicht geladen:`, err instanceof Error ? err.message : err);
        // Radar, Apps und Admin zeigen bei einem Fehler einfach keine Karte (keine Übersetzung für den Ersatztext nötig)
        return id === "apps" || id === "admin" || id === "radar" ? null : ({ id, title: t(`fallback.${id}`), icon: "CircleAlert", items: [], empty: t("unavailable"), error: t("unavailable") } as TodayCard);
      }
    })
  );
  return settled.flat().filter((c): c is TodayCard => Boolean(c));
}
