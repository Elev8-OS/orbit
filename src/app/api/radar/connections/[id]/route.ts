import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasRadarAccess } from "@/lib/radar/access";
import { deleteConnection, setConnectionEnabled } from "@/lib/radar/store";

export const dynamic = "force-dynamic";

const patch = z.object({ enabled: z.boolean() });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  await setConnectionEnabled(gate.user.id, id, parsed.data.enabled);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid" }, { status: 400 });
  await deleteConnection(gate.user.id, id);
  return Response.json({ ok: true });
}
