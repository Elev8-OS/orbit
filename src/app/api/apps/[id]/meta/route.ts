import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { PASS_COOKIE, passIssuer } from "@/lib/orbit-pass";

export const dynamic = "force-dynamic";

/**
 * Neuigkeiten und Glossar einer App für das Info-Panel (ⓘ).
 * Jede eingebettete App liefert /orbit-meta.json an ihrer eigenen Adresse; Orbit holt die Datei
 * serverseitig mit dem Orbit-Pass der angemeldeten Person ab (die Apps geben sie nur damit heraus).
 * "orbit" liefert Orbits eigene Datei aus config/orbit-meta.json.
 * Liefert eine App keine eigene Datei (oder läuft sie direkt in Orbit, wie Offerten), gilt die in
 * config/meta/<id>.json hinterlegte. Gibt es keine, kommt eine leere Liste ("noch keine Einträge").
 */
const EMPTY = JSON.stringify({ changelog: [], glossary: [] });

async function localMeta(id: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return await readFile(path.join(process.cwd(), "config", "meta", `${id}.json`), "utf8");
  } catch {
    return null;
  }
}
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

  const json = (body: string) => new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
  const origin = new URL(app.url).origin;

  // Apps auf eigenen Adressen fragen wir zuerst selbst; Module direkt in Orbit nicht (es gäbe nur eine Schleife)
  if (origin !== new URL(passIssuer()).origin) {
    const pass = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${PASS_COOKIE}=`));
    try {
      const res = await fetch(`${origin}/orbit-meta.json`, {
        headers: pass ? { cookie: pass } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) return json(await res.text());
    } catch {
      /* App nicht erreichbar: hinterlegte Infos verwenden */
    }
  }
  return json((await localMeta(id)) ?? EMPTY);
}
