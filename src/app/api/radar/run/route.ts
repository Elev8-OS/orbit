import { requireUser } from "@/lib/platform/access";
import { hasRadarAccess } from "@/lib/radar/access";
import { runNow } from "@/lib/radar/worker";

export const dynamic = "force-dynamic";

/** Lauf sofort starten. Antwortet gleich; die Oberfläche lädt neu, bis der Lauf fertig ist. */
export async function POST() {
  const gate = await requireUser(hasRadarAccess);
  if ("response" in gate) return gate.response;
  void runNow(gate.user.id).catch((err) => console.error("Radar: manueller Lauf fehlgeschlagen:", err));
  return Response.json({ started: true }, { status: 202 });
}
