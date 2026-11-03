import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  const status = e instanceof EngineError ? e.status : 502;
  return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Antwortmodus von Lea lesen
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  try {
    return Response.json(await engine("/agent/settings"));
  } catch (e) {
    return fail(e);
  }
}

// Antwortmodus von Lea speichern (immer freigeben, immer automatisch, Zeitfenster)
export async function PUT(req: Request) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return Response.json(await engine("/agent/settings", { method: "PUT", body }));
  } catch (e) {
    return fail(e);
  }
}
