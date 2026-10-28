import { currentUser } from "@/lib/platform/access";
import { loadBadges } from "@/lib/platform/badges";

export const dynamic = "force-dynamic";

/** Zahlen für die gelben Punkte auf den Kacheln der Startseite: { "assistent": 3, "radar": 5, … } */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await loadBadges(user), { headers: { "Cache-Control": "no-store" } });
}
