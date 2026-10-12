import { z } from "zod";
import { hasAssistentAccess, requireUser } from "@/lib/platform/access";
import { updateSettings } from "@/lib/assistant/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean().optional(),
  styleNotes: z.string().max(2000).optional(),
  signature: z.string().max(1000).optional(),
  skipSenders: z.string().max(2000).optional(),
  locale: z.enum(["de", "en"]).optional()
});

export async function PUT(req: Request) {
  const r = await requireUser(hasAssistentAccess);
  if ("response" in r) return r.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const account = await updateSettings(r.user.id, parsed.data);
  if (!account) return Response.json({ error: "not_connected" }, { status: 404 });
  return Response.json({ account });
}
