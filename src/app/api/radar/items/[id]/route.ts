import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasRadarAccess } from "@/lib/radar/access";
import { setItemStatus } from "@/lib/radar/store";

export const dynamic = "force-dynamic";

const patch = z.object({ status: z.enum(["open", "done", "discarded"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  const id = Number((await params).id);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  await setItemStatus(gate.user.id, id, parsed.data.status);
  return Response.json({ ok: true });
}
