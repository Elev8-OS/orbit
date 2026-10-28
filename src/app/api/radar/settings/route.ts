import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { hasRadarAccess } from "@/lib/radar/access";
import { updateSettings } from "@/lib/radar/store";

export const dynamic = "force-dynamic";

const body = z.object({
  enabled: z.boolean(),
  runHour: z.number().int().min(0).max(23),
  interests: z.string().max(4000)
});

export async function PUT(req: Request) {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  await updateSettings(gate.user.id, parsed.data);
  return Response.json({ ok: true });
}
