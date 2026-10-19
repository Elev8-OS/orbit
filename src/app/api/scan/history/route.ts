import { requireScanUser } from "@/lib/scan/access";
import { countToday, recentHistory } from "@/lib/scan/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  const [history, today] = await Promise.all([recentHistory(50), countToday(guard.user.id)]);
  return Response.json({ history, today }, { headers: { "Cache-Control": "no-store" } });
}
