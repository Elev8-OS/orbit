import { sql } from "@/lib/db";
import { ADMIN_ROLE } from "@/lib/apps";
import { sendPush, type PushPayload, type Subscription } from "./webpush";

/**
 * Wer bekommt welche Mitteilungen. Kategorien (alle standardmässig an, ausser die Person schaltet sie aus):
 *   myday      tägliche Zusammenfassung „Mein Tag“ (morgens, Uhrzeit wählbar)
 *   assistant  neue Antwortentwürfe des E-Mail-Assistenten
 *   access     Entscheid zu eigenen Zugriffsanfragen
 *   app:<id>   dringende Meldungen einer App (z.B. Support-Tickets, übergebene Leads)
 *   requests   neue Zugriffsanfragen (nur Admins)
 *   status     Störungen und Entwarnungen (nur Admins)
 * Mitteilungen der Administration (broadcast) lassen sich nicht einzeln abschalten, nur alle Mitteilungen auf dem Gerät.
 */
export type Prefs = { categories: Record<string, boolean>; mydayHour: number; mydayWeekend: boolean; tz: string; locale: "de" | "en" };
const DEFAULT_PREFS: Prefs = { categories: {}, mydayHour: 8, mydayWeekend: false, tz: "Europe/Zurich", locale: "de" };

export const enabled = (prefs: Prefs, category: string) => category === "broadcast" || prefs.categories[category] !== false;

export async function getPrefs(userId: string): Promise<Prefs> {
  const [row] = await sql<{ categories: Record<string, boolean>; myday_hour: number; myday_weekend: boolean; tz: string; locale: string }[]>`
    SELECT categories, myday_hour, myday_weekend, tz, locale FROM push_prefs WHERE user_id = ${userId}`;
  if (!row) return { ...DEFAULT_PREFS };
  return { categories: row.categories ?? {}, mydayHour: row.myday_hour, mydayWeekend: row.myday_weekend, tz: row.tz, locale: row.locale === "en" ? "en" : "de" };
}

export async function savePrefs(userId: string, patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs(userId)), ...patch };
  if (patch.categories) next.categories = { ...(await getPrefs(userId)).categories, ...patch.categories };
  await sql`
    INSERT INTO push_prefs (user_id, categories, myday_hour, myday_weekend, tz, locale)
    VALUES (${userId}, ${sql.json(next.categories)}, ${next.mydayHour}, ${next.mydayWeekend}, ${next.tz}, ${next.locale})
    ON CONFLICT (user_id) DO UPDATE SET categories = EXCLUDED.categories, myday_hour = EXCLUDED.myday_hour,
      myday_weekend = EXCLUDED.myday_weekend, tz = EXCLUDED.tz, locale = EXCLUDED.locale, updated_at = now()`;
  return next;
}

export async function subscribe(userId: string, sub: Subscription, userAgent: string | null) {
  // Ein Gerät gehört immer der Person, die zuletzt darauf zugestimmt hat
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${userId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${userAgent?.slice(0, 300) ?? null})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent, fail_count = 0`;
}

export async function unsubscribe(userId: string, endpoint: string) {
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}`;
}

export type Device = { id: number; endpoint: string; userAgent: string | null; createdAt: string; lastSuccessAt: string | null };
export async function devicesOf(userId: string): Promise<Device[]> {
  const rows = await sql<{ id: string; endpoint: string; user_agent: string | null; created_at: Date; last_success_at: Date | null }[]>`
    SELECT id, endpoint, user_agent, created_at, last_success_at FROM push_subscriptions WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map((r) => ({ id: Number(r.id), endpoint: r.endpoint, userAgent: r.user_agent, createdAt: r.created_at.toISOString(), lastSuccessAt: r.last_success_at?.toISOString() ?? null }));
}

export async function usersWithDevices(): Promise<string[]> {
  return (await sql<{ user_id: string }[]>`SELECT DISTINCT user_id FROM push_subscriptions`).map((r) => r.user_id);
}

export async function adminIds(): Promise<string[]> {
  const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM user_directory WHERE ${ADMIN_ROLE} = ANY(roles)`;
  return rows.map((r) => r.user_id);
}

/** Merkt sich, dass etwas gesendet wurde. false, wenn es schon gesendet war. */
export async function claim(userId: string, key: string): Promise<boolean> {
  const rows = await sql`INSERT INTO push_log (user_id, key) VALUES (${userId}, ${key}) ON CONFLICT DO NOTHING RETURNING 1`;
  return rows.length > 0;
}
export async function wasSent(userId: string, key: string): Promise<boolean> {
  return (await sql`SELECT 1 FROM push_log WHERE user_id = ${userId} AND key = ${key}`).length > 0;
}

export type Delivery = { users: number; devices: number; delivered: number; failed: number };

/**
 * Sendet an alle Geräte der genannten Personen, sofern sie die Kategorie nicht abgeschaltet haben.
 * Der Text kann pro Person (Sprache) gebaut werden. dedupe: Schlüssel, unter dem pro Person nur einmal gesendet wird.
 */
export async function notify(
  userIds: string[],
  category: string,
  build: PushPayload | ((prefs: Prefs) => PushPayload | null),
  opts: { dedupe?: string; urgency?: "normal" | "high"; ttl?: number } = {}
): Promise<Delivery> {
  const result: Delivery = { users: 0, devices: 0, delivered: 0, failed: 0 };
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return result;
  const subs = await sql<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[]>`
    SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY(${ids})`;
  type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
  const byUser = new Map<string, Sub[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  for (const [userId, devices] of byUser) {
    const prefs = await getPrefs(userId);
    if (!enabled(prefs, category)) continue;
    const payload = typeof build === "function" ? build(prefs) : build;
    if (!payload) continue;
    if (opts.dedupe && !(await claim(userId, opts.dedupe))) continue;
    result.users++;
    for (const d of devices) {
      result.devices++;
      const r = await sendPush(d, payload, { urgency: opts.urgency, ttl: opts.ttl });
      if (r.ok) {
        result.delivered++;
        await sql`UPDATE push_subscriptions SET last_success_at = now(), fail_count = 0 WHERE id = ${d.id}`;
      } else {
        result.failed++;
        if (r.gone) await sql`DELETE FROM push_subscriptions WHERE id = ${d.id}`;
        else await sql`UPDATE push_subscriptions SET fail_count = fail_count + 1 WHERE id = ${d.id}`;
      }
    }
  }
  // Geräte, die seit Wochen nur noch Fehler liefern, entfernen
  await sql`DELETE FROM push_subscriptions WHERE fail_count >= 20`;
  return result;
}

/** Fehler beim Senden dürfen den eigentlichen Ablauf (Entscheid, Statusprüfung …) nie stören. */
export function notifySafe(...args: Parameters<typeof notify>) {
  return notify(...args).catch((err) => {
    console.error("Push nicht gesendet:", err);
    return null;
  });
}

/** Link, den die Mitteilung beim Antippen öffnet. */
export function targetUrl(target: { app: string; path?: string | null } | { href: string }): string {
  if ("href" in target) return target.href;
  const p = new URLSearchParams({ app: target.app });
  if (target.path) p.set("path", target.path);
  return `/?${p}`;
}
