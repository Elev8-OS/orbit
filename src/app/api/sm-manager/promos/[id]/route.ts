import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  const status = e instanceof EngineError ? e.status : 502;
  return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Aktion ändern (Code, Eckdaten, Fenster, Status)
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return Response.json(await engine(`/promos/${id}`, { method: "PUT", body }));
  } catch (e) {
    return fail(e);
  }
}

// Aktion löschen
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  try {
    return Response.json(await engine(`/promos/${id}`, { method: "DELETE" }));
  } catch (e) {
    return fail(e);
  }
}
