import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  const status = e instanceof EngineError ? e.status : 502;
  return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Konkurrenz-Konten mit den zuletzt gelesenen Zahlen
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  try {
    return Response.json(await engine("/competitors"));
  } catch (e) {
    return fail(e);
  }
}

// Konto hinzufügen ({ handle }) oder alle Konten neu prüfen ({ action: "refresh" })
export async function POST(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { handle?: unknown; action?: unknown };
  try {
    if (body.action === "refresh") return Response.json(await engine("/competitors/refresh", { method: "POST", body: {} }));
    return Response.json(await engine("/competitors", { method: "POST", body: { handle: body.handle } }), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

// Konto entfernen (?handle=name)
export async function DELETE(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const handle = new URL(req.url).searchParams.get("handle") ?? "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return Response.json({ error: "invalid handle" }, { status: 400 });
  try {
    return Response.json(await engine(`/competitors/${encodeURIComponent(handle)}`, { method: "DELETE" }));
  } catch (e) {
    return fail(e);
  }
}
