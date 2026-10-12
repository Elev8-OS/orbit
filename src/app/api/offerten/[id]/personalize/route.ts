import { z } from "zod";
import { requireOffertenUser } from "@/lib/offerten/access";
import { personalizeConfigured, writeQuoteTexts } from "@/lib/offerten/personalize";
import { refreshLines } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { getQuote, logEvent, updateDraft } from "@/lib/offerten/store";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const bodySchema = z.object({ addressForm: z.enum(["du", "sie"]).optional() });

/** Texte und Mail aus Gespräch und GHL-Verlauf neu schreiben lassen (überschreibt die bisherigen Texte). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!personalizeConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  const quote = await getQuote((await params).id);
  if (!quote) return Response.json({ error: "not_found" }, { status: 404 });
  if (quote.status !== "draft") return Response.json({ error: "not_editable" }, { status: 409 });
  const settings = await getSettings();
  try {
    const { texts, sources } = await writeQuoteTexts({ ...quote, lines: refreshLines(quote, settings) }, settings, {
      name: access.user.name
    }, { addressForm: body.success ? body.data.addressForm : undefined });
    const updated = await updateDraft(quote.id, { texts });
    await logEvent(quote.id, access.user.name, "personalized", { sources });
    return Response.json({ quote: updated, sources });
  } catch (err) {
    console.error("Persönliche Texte:", err);
    return Response.json({ error: "personalize_failed" }, { status: 502 });
  }
}
