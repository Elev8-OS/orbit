import { requireUser } from "@/lib/platform/access";
import { hasSmAccess } from "@/lib/sm-manager/access";
import { EngineError, engine } from "@/lib/sm-manager/client";

export const dynamic = "force-dynamic";

// Vorschläge für Aktionen nach freien Nächten (wird nach dem Öffnen des Tabs nachgeladen, weil Elev8 einige Sekunden braucht)
export async function GET() {
  const gate = await requireUser(hasSmAccess);
  if ("response" in gate) return gate.response;
  try {
    return Response.json(await engine("/promos/suggestions?days=60"));
  } catch (e) {
    const status = e instanceof EngineError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
