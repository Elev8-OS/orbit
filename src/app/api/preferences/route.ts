import { z } from "zod";
import { auth } from "@/auth";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { saveTileOrder } from "@/lib/preferences";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  order: z.array(z.string().max(64)).max(500)
});

/** Speichert die Kachel-Reihenfolge. Nur IDs von Apps, die der User sehen darf, werden übernommen. */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  const config = await loadAppsConfig();
  const allowed = new Set(visibleApps(config, session.user.roles).map((a) => a.id));
  const order = [...new Set(parsed.data.order)].filter((id) => allowed.has(id));

  try {
    await saveTileOrder(session.user.id, order);
  } catch (err) {
    console.error("Reihenfolge nicht gespeichert:", err);
    return Response.json({ error: "db_unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
