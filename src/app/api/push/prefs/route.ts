import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { getPrefs, savePrefs } from "@/lib/push/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  categories: z.record(z.string().regex(/^[a-z0-9:-]+$/).max(64), z.boolean()).optional(),
  mydayHour: z.number().int().min(0).max(23).optional(),
  mydayWeekend: z.boolean().optional()
});

export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  return Response.json({ prefs: await getPrefs(r.user.id) });
}

export async function PUT(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  return Response.json({ prefs: await savePrefs(r.user.id, parsed.data) });
}
