import { z } from "zod";
import { requireUser } from "@/lib/platform/access";
import { recordUsage } from "@/lib/platform/usage";

export const dynamic = "force-dynamic";

/** Orbit meldet jedes Öffnen einer App (für die Nutzungszahlen in der Administration). */
export async function POST(req: Request) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const parsed = z.object({ app: z.string().regex(/^[a-z0-9-]+$/).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  await recordUsage(r.user.id, parsed.data.app).catch((err) => console.error("Nutzung nicht gespeichert:", err));
  return new Response(null, { status: 204 });
}
