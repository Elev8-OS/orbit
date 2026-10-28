import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { hasSalesAccess, SALES_ADMIN_ROLE } from "@/lib/sales/access";
import { ghlConfigured } from "@/lib/sales/ghl";
import { loadToday, resolveViewer, validTimeZone } from "@/lib/sales/service";
import { hasOffertenAccess } from "@/lib/offerten/access";
import * as assistant from "@/lib/assistant/store";
import { hasRadarAccess, radarEnabled } from "@/lib/radar/access";
import * as radar from "@/lib/radar/store";
import { hasAssistentAccess, type PlatformUser } from "./access";
import { callIntegration } from "./integrations";

/**
 * Zahlen für die gelben Punkte auf den Kacheln: pro App, was ungelesen oder unbearbeitet ist.
 * Schlüssel ist die App-ID aus config/apps.yaml, Wert die Anzahl (nur > 0).
 *
 * Quellen (nur, wo die Person die App sehen darf):
 * - assistent: offene Antwortentwürfe des E-Mail-Assistenten
 * - radar: offene Treffer
 * - offerten: Entwürfe und fällige Nachfass-Termine
 * - sales: fällige Aufgaben und heutige Termine (wie in Mein Tag)
 * - jede App mit integrations.today (Lead Bot, Support Bot …): die Zahl, die sie selbst melden
 *
 * Jede Quelle hat ein Zeitlimit und fällt bei Fehlern einfach weg. Das Ergebnis wird 60 Sekunden pro Person
 * zwischengespeichert, damit häufiges Neuladen weder GHL noch die Apps belastet.
 */
export type Badges = Record<string, number>;

const TTL_MS = 60_000;
const TIMEOUT_MS = 6000;
const cache = new Map<string, { at: number; badges: Badges }>();

const withTimeout = <T,>(p: Promise<T>, ms = TIMEOUT_MS) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function assistentCount(user: PlatformUser): Promise<Badges> {
  if (!hasAssistentAccess(user.roles)) return {};
  if (!(await assistant.getAccount(user.id))) return {};
  return { assistent: (await assistant.counts(user.id)).open };
}

async function radarCount(user: PlatformUser): Promise<Badges> {
  if (!radarEnabled() || !hasRadarAccess(user.roles)) return {};
  return { radar: (await radar.counts(user.id)).open };
}

async function offertenCount(user: PlatformUser, tz: string): Promise<Badges> {
  if (!hasOffertenAccess(user.roles)) return {};
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const [row] = await sql<{ n: number }[]>`
    SELECT ((SELECT count(*) FROM quotes WHERE status = 'draft')
          + (SELECT count(*) FROM quotes WHERE status = 'sent' AND outcome = 'open' AND follow_up_at <= ${today}::date))::int AS n`;
  return { offerten: row?.n ?? 0 };
}

async function salesCount(user: PlatformUser, tz: string): Promise<Badges> {
  if (!hasSalesAccess(user.roles) || !ghlConfigured()) return {};
  const viewer = await resolveViewer({ id: user.id, name: user.name, email: user.email, isManager: user.admin || user.roles.includes(SALES_ADMIN_ROLE) });
  if (!viewer.ok) return {};
  const data = await loadToday(viewer.viewer, tz);
  return { sales: data.tasks.filter((x) => x.bucket !== "soon").length + data.events.filter((e) => e.day === "today").length };
}

async function appCounts(user: PlatformUser): Promise<Badges> {
  const config = await loadAppsConfig();
  const apps = visibleApps(config, user.roles).filter((a) => a.integrations?.today);
  const out: Badges = {};
  await Promise.all(
    apps.map(async (app) => {
      try {
        const list = await callIntegration(app, "today", user);
        if (list) out[app.id] = list.count ?? list.items.length;
      } catch {
        /* App antwortet nicht: kein Punkt */
      }
    })
  );
  return out;
}

export async function loadBadges(user: PlatformUser): Promise<Badges> {
  const hit = cache.get(user.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.badges;
  const tz = validTimeZone((await cookies()).get("SALES_TZ")?.value);
  const parts = await Promise.all(
    [assistentCount(user), radarCount(user), offertenCount(user, tz), salesCount(user, tz), appCounts(user)].map((p) =>
      withTimeout(p).catch((err) => {
        console.warn("Kachel-Zähler: Quelle nicht geladen:", err instanceof Error ? err.message : err);
        return {} as Badges;
      })
    )
  );
  const badges: Badges = {};
  for (const part of parts) for (const [id, n] of Object.entries(part)) if (n > 0) badges[id] = n;
  cache.set(user.id, { at: Date.now(), badges });
  return badges;
}
