import { requireScanUser } from "@/lib/scan/access";
import { crmFieldDefs, ghlConfigured, listTags } from "@/lib/scan/ghl";
import { claudeConfigured } from "@/lib/scan/extract";
import { recentHistory } from "@/lib/scan/store";
import { listEvents, type EventSummary } from "@/lib/messen/store";
import { userByEmail } from "@/lib/sales/ghl";
import type { ScanContext, ScanHistoryEntry } from "@/lib/scan/types";
import type { CrmField } from "@/lib/scan/crm";

export const dynamic = "force-dynamic";

/** Alles, was der Scanner beim Start braucht: User, Konfiguration, aktive Messen, GHL-Tags, letzte Scans. */
export async function GET() {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const ghl = ghlConfigured();

  const [events, tags, history, ghlUser, crmFields] = await Promise.all([
    listEvents().catch((): EventSummary[] => []),
    ghl ? listTags().catch(() => [] as string[]) : Promise.resolve([] as string[]),
    recentHistory(50).catch((): ScanHistoryEntry[] => []),
    ghl ? userByEmail(user.email).catch(() => null) : Promise.resolve(null),
    ghl ? crmFieldDefs().catch((): CrmField[] => []) : Promise.resolve([] as CrmField[])
  ]);

  const ctx: ScanContext = {
    user: { id: user.id, name: user.name, email: user.email, ghlUserId: ghlUser?.id ?? null },
    ghlConfigured: ghl,
    claudeConfigured: claudeConfigured(),
    enrichConfigured: Boolean(process.env.PDL_API_KEY),
    events: events.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name, slug: e.slug, tags: e.ghlTags })),
    tags,
    history,
    crmFields
  };
  return Response.json(ctx, { headers: { "Cache-Control": "no-store" } });
}
