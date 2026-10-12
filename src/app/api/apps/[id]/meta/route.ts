import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { PASS_COOKIE } from "@/lib/orbit-pass";

export const dynamic = "force-dynamic";

/**
 * Neuigkeiten und Glossar einer App für das Info-Panel (ⓘ).
 * Jede eingebettete App liefert /orbit-meta.json an ihrer eigenen Adresse; Orbit holt die Datei
 * serverseitig mit dem Orbit-Pass der angemeldeten Person ab (die Apps geben sie nur damit heraus).
 * "orbit" liefert Orbits eigene Datei aus config/orbit-meta.json.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const headers = { "Cache-Control": "private, max-age=300" };

  if (id === "orbit") {
    try {
      const raw = await readFile(path.join(process.cwd(), "config", "orbit-meta.json"), "utf8");
      return new Response(raw, { headers: { ...headers, "Content-Type": "application/json" } });
    } catch {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
  }

  const config = await loadAppsConfig();
  const app = visibleApps(config, session.user.roles ?? []).find((a) => a.id === id && a.embed);
  if (!app) return Response.json({ error: "not_found" }, { status: 404 });

  const pass = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PASS_COOKIE}=`));
  try {
    const res = await fetch(`${new URL(app.url).origin}/orbit-meta.json`, {
      headers: pass ? { cookie: pass } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return Response.json({ error: "unavailable" }, { status: res.status === 404 ? 404 : 502 });
    return new Response(await res.text(), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
