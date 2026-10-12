import { auth } from "@/auth";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { PASS_COOKIE, passIssuer } from "@/lib/orbit-pass";

export const dynamic = "force-dynamic";

/**
 * Puls für den Kopf der Übersicht: Kennzahlen und offene Punkte aus allen Apps der Person.
 * Jede eingebettete App kann /orbit-pulse.json liefern (nur mit Orbit-Pass, nach Rolle gefiltert):
 *   { metrics: [{ id, label: {de,en}, value, detail?: {de,en}, path? }],
 *     actions: [{ id, tone: "red"|"amber"|"info", text: {de,en}, path? }] }
 * Apps ohne Datei oder ohne Antwort innert 4 Sekunden werden übersprungen.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  const config = await loadAppsConfig();
  const orbitOrigin = new URL(passIssuer()).origin;
  const apps = visibleApps(config, session.user.roles ?? []).filter((a) => a.embed && new URL(a.url).origin !== orbitOrigin);
  const pass = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PASS_COOKIE}=`));

  const results = await Promise.all(
    apps.map(async (app) => {
      try {
        const res = await fetch(`${new URL(app.url).origin}/orbit-pulse.json`, {
          headers: pass ? { cookie: pass } : {},
          cache: "no-store",
          signal: AbortSignal.timeout(4000)
        });
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
        const data = (await res.json()) as { metrics?: unknown[]; actions?: unknown[] };
        return {
          app: app.id,
          name: app.name,
          metrics: Array.isArray(data.metrics) ? data.metrics.slice(0, 4) : [],
          actions: Array.isArray(data.actions) ? data.actions.slice(0, 5) : []
        };
      } catch {
        return null;
      }
    })
  );

  return Response.json({ apps: results.filter(Boolean) }, { headers: { "Cache-Control": "private, max-age=60" } });
}
