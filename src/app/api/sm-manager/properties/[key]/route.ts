import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

const body = z.object({ active: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  const key = (await params).key;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!/^[a-z0-9-]{1,40}$/.test(key) || !parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await engine(`/properties/${key}`, { method: "PUT", body: parsed.data });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
