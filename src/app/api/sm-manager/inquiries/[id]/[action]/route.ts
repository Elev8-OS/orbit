import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

const body = z.object({ message: z.string().max(2000).optional() });
const ACTIONS = ["send", "dismiss", "redraft"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const p = await params;
  const id = Number(p.id);
  const action = ACTIONS.find((a) => a === p.action) as Action | undefined;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !action || !parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await engine(`/agent/inquiries/${id}/${action}`, { method: "POST", body: action === "send" ? { message: parsed.data.message } : {} });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
