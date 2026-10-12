import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { ghlConfigured, updateOpportunityStatus } from "@/lib/offerten/ghl";
import { getQuote, logEvent, setTracking } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    followUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    outcome: z.enum(["open", "won", "lost"]),
    outcomeNote: z.string().max(1000).nullable()
  })
  .partial();

/** Nächstes Nachfassen verschieben oder Ergebnis setzen (gewonnen/verloren wird auch in GHL gesetzt). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const id = (await params).id;
  const before = await getQuote(id);
  if (!before) return Response.json({ error: "not_found" }, { status: 404 });
  const patch = { ...parsed.data };
  if (patch.outcome && patch.outcome !== "open") patch.followUpAt = null;
  const quote = await setTracking(id, patch);
  if (!quote) return Response.json({ error: "not_sent" }, { status: 409 });

  let ghl: { ok: boolean; error?: string } | null = null;
  if (parsed.data.outcome && parsed.data.outcome !== before.outcome && quote.ghlOpportunityId && ghlConfigured()) {
    try {
      await updateOpportunityStatus(quote.ghlOpportunityId, parsed.data.outcome);
      ghl = { ok: true };
    } catch (err) {
      ghl = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  await logEvent(id, access.user.name, parsed.data.outcome ? `outcome_${quote.outcome}` : "follow_up_moved", {
    followUpAt: quote.followUpAt,
    note: quote.outcomeNote,
    ghl
  });
  return Response.json({ quote, ghl });
}
