import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

const body = z.object({
  status: z.enum(["approved", "scheduled", "rejected", "rendered"]),
  feedback: z.string().max(1000).optional(),
  scheduledFor: z.string().datetime().optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await engine(`/posts/${id}/status`, { method: "POST", body: parsed.data });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
