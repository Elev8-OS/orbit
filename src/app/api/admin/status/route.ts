import { requireAdmin } from "@/lib/platform/access";
import { runStatusChecks } from "@/lib/platform/status";
import { audit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** „Jetzt prüfen“ auf der Statusseite. */
export async function POST() {
  const r = await requireAdmin();
  if ("response" in r) return r.response;
  const results = await runStatusChecks();
  await audit({ id: r.user.id, email: r.user.email }, "status.check", null, { down: results.filter((x) => x.state === "down").map((x) => x.id) });
  return Response.json({ results });
}
