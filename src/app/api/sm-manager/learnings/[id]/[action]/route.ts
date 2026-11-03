import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

const ACTIONS = ["accept", "dismiss"] as const;
const params = z.object({ id: z.coerce.number().int().positive(), action: z.enum(ACTIONS) });

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const parsed = params.safeParse(await ctx.params);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await engine(`/learnings/${parsed.data.id}/${parsed.data.action}`, { method: "POST", body: {} });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
