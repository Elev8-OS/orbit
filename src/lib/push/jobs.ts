import { sql } from "@/lib/db";
import { isAdmin, loadAppsConfig, visibleApps } from "@/lib/apps";
import { hasSalesAccess, SALES_ADMIN_ROLE } from "@/lib/sales/access";
import { ghlConfigured } from "@/lib/sales/ghl";
import { loadToday, resolveViewer, validTimeZone } from "@/lib/sales/service";
import { hasOffertenAccess } from "@/lib/offerten/access";
import * as assistant from "@/lib/assistant/store";
import { hasAssistentAccess, type PlatformUser } from "@/lib/platform/access";
import { callIntegration } from "@/lib/platform/integrations";
import { getPrefs, notify, claim, wasSent, enabled, targetUrl, usersWithDevices, type Prefs } from "./service";
import { pushText } from "./texts";

/**
 * Hintergrundaufgabe für Mitteilungen, alle 5 Minuten (scheduler.ts):
 * 1. fällige Mitteilungen der Administration senden
 * 2. „Mein Tag“ am Morgen (Uhrzeit pro Person, in ihrer Zeitzone)
 * 3. neue dringende Meldungen aus angebundenen Apps (Support-Tickets, übergebene Leads)
 */
export async function runPushJobs() {
  await sendDueBroadcasts();
  const ids = await usersWithDevices();
  if (!ids.length) return;
  const users = await directoryUsers(ids);
  for (const user of users) {
    const prefs = await getPrefs(user.id);
    await sendMyDay(user, prefs).catch((err) => console.warn(`Mein Tag (Push) für ${user.email}:`, err instanceof Error ? err.message : err));
    await watchApps(user, prefs).catch((err) => console.warn(`App-Meldungen (Push) für ${user.email}:`, err instanceof Error ? err.message : err));
  }
  await sql`DELETE FROM push_log WHERE sent_at < now() - interval '45 days'`;
}

async function directoryUsers(ids: string[]): Promise<PlatformUser[]> {
  const rows = await sql<{ user_id: string; name: string | null; email: string | null; roles: string[] }[]>`
    SELECT user_id, name, email, roles FROM user_directory WHERE user_id = ANY(${ids})`;
  return rows.map((r) => ({ id: r.user_id, name: r.name || r.email || "Elev8", email: (r.email ?? "").toLowerCase(), roles: r.roles, admin: isAdmin(r.roles) }));
}

// ── Mein Tag ─────────────────────────────────────────────────────────────────────

function localParts(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekend: p.weekday === "Sat" || p.weekday === "Sun" };
}

/** Kurzfassung von „Mein Tag“ als eine Zeile. null = heute steht nichts an. */
export async function myDayDigest(user: PlatformUser, prefs: Prefs): Promise<{ title: string; body: string } | null> {
  const t = pushText(prefs.locale);
  const tz = validTimeZone(prefs.tz);
  const parts: string[] = [];
  const soft = async (fn: () => Promise<void>) => {
    try {
      await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
    } catch (err) {
      console.warn("Mein Tag (Push): Quelle übersprungen:", err instanceof Error ? err.message : err);
    }
  };

  if (hasSalesAccess(user.roles) && ghlConfigured()) {
    await soft(async () => {
      const v = await resolveViewer({ id: user.id, name: user.name, email: user.email, isManager: user.admin || user.roles.includes(SALES_ADMIN_ROLE) });
      if (!v.ok) return;
      const d = await loadToday(v.viewer, tz);
      const meetings = d.events.filter((e) => e.day === "today").sort((a, b) => a.start.localeCompare(b.start));
      const due = d.tasks.filter((x) => x.bucket !== "soon").length;
      if (meetings.length) {
        const first = new Intl.DateTimeFormat(prefs.locale === "en" ? "en-GB" : "de-CH", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(meetings[0].start));
        parts.push(t.meetings(meetings.length, first));
      }
      if (due) parts.push(t.tasks(due));
    });
  }
  if (hasOffertenAccess(user.roles)) {
    await soft(async () => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
      const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM quotes WHERE status = 'sent' AND outcome = 'open' AND follow_up_at <= ${today}::date`;
      if (r?.n) parts.push(t.followUps(r.n));
    });
  }
  if (hasAssistentAccess(user.roles)) {
    await soft(async () => {
      const c = await assistant.counts(user.id);
      if (c.open) parts.push(t.drafts(c.open, c.high));
    });
  }
  await soft(async () => {
    const config = await loadAppsConfig();
    const apps = visibleApps(config, user.roles).filter((a) => a.integrations?.today);
    const lists = await Promise.all(apps.map(async (app) => ({ app, list: await callIntegration(app, "today", user) })));
    for (const { app, list } of lists) {
      const n = list?.count ?? list?.items.length ?? 0;
      if (n) parts.push(t.appCount(list?.title || app.name[prefs.locale], n));
    }
  });
  if (user.admin) {
    await soft(async () => {
      const [r] = await sql<{ req: number; inc: number }[]>`
        SELECT (SELECT count(*)::int FROM access_requests WHERE status = 'open') AS req,
               (SELECT count(*)::int FROM service_incidents WHERE ended_at IS NULL) AS inc`;
      if (r?.inc) parts.push(t.incidents(r.inc));
      if (r?.req) parts.push(t.requests(r.req));
    });
  }
  if (!parts.length) return null;
  const date = new Intl.DateTimeFormat(prefs.locale === "en" ? "en-GB" : "de-CH", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return { title: t.mydayTitle(date), body: parts.join(" · ") };
}

async function sendMyDay(user: PlatformUser, prefs: Prefs) {
  if (!enabled(prefs, "myday")) return;
  const now = localParts(validTimeZone(prefs.tz));
  // Nur im Zeitfenster bis 3 Stunden nach der gewählten Uhrzeit, damit nach einem Ausfall nicht nachts nachgeliefert wird
  if (now.hour < prefs.mydayHour || now.hour >= prefs.mydayHour + 3) return;
  if (now.weekend && !prefs.mydayWeekend) return;
  const key = `myday:${now.date}`;
  if (await wasSent(user.id, key)) return;
  const digest = await myDayDigest(user, prefs);
  if (!digest) {
    await claim(user.id, key); // heute nichts zu melden: nicht stören, nicht nochmals prüfen
    return;
  }
  await notify([user.id], "myday", { ...digest, url: "/", tag: "myday" }, { dedupe: key, ttl: 4 * 3600 });
}

// ── Dringende Meldungen aus Apps ─────────────────────────────────────────

async function watchApps(user: PlatformUser, prefs: Prefs) {
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles).filter((a) => a.integrations?.today && enabled(prefs, `app:${a.id}`));
  const t = pushText(prefs.locale);
  for (const app of apps) {
    const list = await callIntegration(app, "today", user);
    if (!list) continue;
    const urgent = list.items.filter((i) => (i.tone === "danger" || i.tone === "warning") && i.id);
    const seedKey = `seed:${app.id}`;
    const firstTime = !(await wasSent(user.id, seedKey));
    const fresh: typeof urgent = [];
    for (const item of urgent) if (await claim(user.id, `app:${app.id}:${item.id}`)) fresh.push(item);
    if (firstTime) {
      // Beim ersten Mal nur merken, was schon da ist, statt alles auf einmal zu melden
      await claim(user.id, seedKey);
      continue;
    }
    if (!fresh.length) continue;
    const name = list.title || app.name[prefs.locale];
    if (fresh.length <= 2) {
      for (const item of fresh) {
        await notify([user.id], `app:${app.id}`, {
          title: item.title,
          body: [name, item.meta].filter(Boolean).join(" · "),
          url: targetUrl({ app: app.id, path: item.path }),
          tag: `${app.id}-${item.id}`
        }, { urgency: item.tone === "danger" ? "high" : "normal" });
      }
    } else {
      await notify([user.id], `app:${app.id}`, { title: t.moreItems(name, fresh.length), body: t.moreBody, url: targetUrl({ app: app.id }), tag: app.id }, { urgency: "high" });
    }
  }
}

// ── Mitteilungen der Administration ──────────────────────────────────────

export type Audience = { type: "all" } | { type: "roles"; roles: string[] } | { type: "users"; ids: string[] };

export async function audienceIds(audience: Audience): Promise<string[]> {
  const rows = await sql<{ user_id: string; roles: string[] }[]>`
    SELECT d.user_id, d.roles FROM user_directory d WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = d.user_id)`;
  if (audience.type === "all") return rows.map((r) => r.user_id);
  if (audience.type === "roles") return rows.filter((r) => r.roles.some((x) => audience.roles.includes(x))).map((r) => r.user_id);
  const wanted = new Set(audience.ids);
  return rows.filter((r) => wanted.has(r.user_id)).map((r) => r.user_id);
}

export async function sendBroadcast(id: number) {
  const [b] = await sql<{ id: string; title: string; body: string; url: string | null; audience: Audience }[]>`
    UPDATE push_broadcasts SET sent_at = now() WHERE id = ${id} AND sent_at IS NULL AND cancelled_at IS NULL
    RETURNING id, title, body, url, audience`;
  if (!b) return null;
  const ids = await audienceIds(b.audience);
  const r = await notify(ids, "broadcast", { title: b.title, body: b.body, url: b.url || "/", tag: `broadcast-${b.id}` }, { ttl: 3 * 24 * 3600 });
  await sql`UPDATE push_broadcasts SET recipients = ${r.users}, devices = ${r.devices}, delivered = ${r.delivered}, failed = ${r.failed} WHERE id = ${id}`;
  return r;
}

async function sendDueBroadcasts() {
  const due = await sql<{ id: string }[]>`SELECT id FROM push_broadcasts WHERE sent_at IS NULL AND cancelled_at IS NULL AND scheduled_at <= now() ORDER BY scheduled_at LIMIT 10`;
  for (const b of due) await sendBroadcast(Number(b.id)).catch((err) => console.error("Mitteilung nicht gesendet:", err));
}
