import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Audit einer an Meta gesendeten Anzeige: die Engine liest sie live aus Meta und meldet, was fehlt. Nur lesen, es wird nichts geändert. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json(await engine(`/ads/${id}/audit`));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
